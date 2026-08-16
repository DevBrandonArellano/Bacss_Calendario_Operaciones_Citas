# Fase 12B — API Pública de Integración Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer un namespace `/api/public/v1/` separado de la API interna, consumible por sistemas de terceros vía API Key u OAuth2 client-credentials, con scopes granulares, tenant resuelto desde la credencial, idempotencia, rate limiting y webhooks salientes firmados.

**Architecture:** Nueva app `apps/integrations/` que NO duplica lógica de negocio: los viewsets públicos reutilizan directamente los mismos modelos/serializers/casos de uso que ya usa la API interna (`apps.customers`, `apps.appointments`, `apps.payments`, `apps.services`, `apps.scheduling`), y solo añaden una capa de autenticación (API Key / JWT de client-credentials), autorización por scope, throttling y (para escrituras) idempotencia. El tenant se resuelve una sola vez por request en `core.middleware.CurrentOrganizationMiddleware`, reutilizando el mecanismo de `contextvars` ya existente (`core/context.py`) — así el resto del código (managers tenant-aware, casos de uso) no necesita saber que la request vino de un tercero. Los webhooks salientes se enganchan al bus de eventos de dominio que ya existe (`core/events.py`, usado por `apps.notifications`) sin tocar los emisores existentes, salvo tres eventos agregados (`order.status_changed`, `work_order.status_changed`, `case.status_changed`) que faltaban para cubrir el catálogo documentado.

**Tech Stack:** Django 5 / DRF, `PyJWT` (nuevo, para el token de client-credentials — ya es dependencia transitiva de `djangorestframework-simplejwt`, se declara explícita), `requests` (nuevo, para la entrega HTTP de webhooks), Celery (reintentos con backoff), `django.contrib.auth.hashers` (hash de secretos de credenciales, mismo mecanismo que contraseñas), PostgreSQL `JSONField` (scopes, eventos suscritos, payloads).

**Spec:** `docs/public-api.md` (ver sección "Alcance del v1" agregada al inicio del archivo — recorta recursos de módulo activo, notificación de fallo de webhook, y portal de developers dedicado). Complementa: `docs/error-handling.md`, `docs/logging.md`, `docs/auth-rbac.md`.

## Global Constraints

- **Regla #1 no negociable (CLAUDE.md):** el tenant de cada request público se resuelve SIEMPRE desde la credencial autenticada (`ApiKey.organization` / `OAuthClient.organization`), nunca de un campo del body o un parámetro de la URL.
- Ningún secreto de credencial (API key secret, OAuth client secret, webhook signing secret) se devuelve más de una vez ni se registra en logs/auditoría en claro. Se hashea con `django.contrib.auth.hashers.make_password`/`check_password` (excepto el secreto de firma de webhook, que debe quedar recuperable en claro para firmar HMAC — se documenta esa excepción explícitamente donde corresponda).
- Todos los modelos de negocio nuevos que representen datos de UNA organización (`WebhookEndpoint`, `WebhookDelivery`, `IdempotencyKey`) heredan de `TenantAwareModel` (`core/models.py`) porque se leen/escriben siempre DESPUÉS de que el middleware ya resolvió el tenant. `ApiKey` y `OAuthClient` NO heredan de `TenantAwareModel` (se buscan por prefijo/`client_id` ANTES de que exista contexto de tenant, igual que `apps.users.models.User`) — llevan un FK `organization` normal y un manager plano.
- Formato de error uniforme (`docs/error-handling.md`) para toda respuesta de error de `/api/public/v1/...`, sin excepción — se reutiliza `core.exception_handler.domain_exception_handler` sin cambios.
- Cobertura ≥ 90% en control de acceso (aislamiento entre credenciales/organizaciones, scopes insuficientes) — no negociable, ver `CLAUDE.md`.
- Todo test de este plan corre contra `pytest --reuse-db` (`config/settings/test.py`), consistente con el resto del backend.

---

## Task 1: Scaffold de `apps/integrations/`, dependencias y catálogo de scopes

**Files:**
- Modify: `backend/pyproject.toml`
- Create: `backend/apps/integrations/__init__.py`
- Create: `backend/apps/integrations/apps.py`
- Create: `backend/apps/integrations/scopes.py`
- Create: `backend/apps/integrations/tests/__init__.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/config/urls.py`
- Create: `backend/apps/integrations/public_urls.py` (vacío por ahora, se llena en tareas siguientes)
- Create: `backend/apps/integrations/internal_urls.py` (vacío por ahora)

**Interfaces:**
- Produces: `apps.integrations.scopes.PUBLIC_API_SCOPES: list[str]`, `apps.integrations.scopes.validate_scopes(scopes: list[str]) -> None` (lanza `core.exceptions.ValidationError` si algún scope no está en el catálogo) — usado por las Tareas 2 y 6.

- [ ] **Step 1: Agregar dependencias**

En `backend/pyproject.toml`, dentro de `dependencies`, agregar (mismo estilo que las existentes, orden alfabético no estricto pero cerca de `djangorestframework-simplejwt`):

```toml
    "pyjwt>=2.9,<2.10",
    "requests>=2.32,<2.33",
```

- [ ] **Step 2: Instalar dependencias**

Run: `cd backend && pip install -e ".[dev]"`
Expected: instala `PyJWT` y `requests` sin errores (probablemente ya están presentes transitivamente, pero deben quedar declaradas).

- [ ] **Step 3: Crear el scaffold de la app**

`backend/apps/integrations/__init__.py`: vacío.

`backend/apps/integrations/apps.py`:

```python
from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.integrations"
    label = "integrations"

    def ready(self) -> None:
        from apps.integrations.webhooks import register_webhook_dispatch

        register_webhook_dispatch()
```

(`register_webhook_dispatch` se implementa en la Tarea 12; por ahora, para que la app cargue, crear un stub en `backend/apps/integrations/webhooks.py`:)

```python
from __future__ import annotations


def register_webhook_dispatch() -> None:
    """Suscribe el dispatcher de webhooks al bus de eventos. Implementado en Tarea 12."""
```

- [ ] **Step 4: Catálogo de scopes**

`backend/apps/integrations/scopes.py`:

```python
from __future__ import annotations

from core import exceptions as domain_exceptions

PUBLIC_API_SCOPES: list[str] = [
    "customers:read",
    "customers:write",
    "services:read",
    "availability:read",
    "appointments:read",
    "appointments:write",
    "payments:read",
    "payments:write",
    "webhooks:manage",
]


def validate_scopes(scopes: list[str]) -> None:
    invalid = sorted(set(scopes) - set(PUBLIC_API_SCOPES))
    if invalid:
        raise domain_exceptions.ValidationError(
            "Uno o más scopes no existen en el catálogo público.",
            details={"invalid_scopes": invalid, "valid_scopes": PUBLIC_API_SCOPES},
        )
```

- [ ] **Step 5: Registrar la app y las rutas**

En `backend/config/settings/base.py`, agregar `"apps.integrations",` a `INSTALLED_APPS`, después de `"apps.reports",` y antes del comentario de módulos especializados.

Agregar a `DEFAULT_THROTTLE_RATES` (dentro de `REST_FRAMEWORK`):

```python
        "public_api": "60/min",
```

`backend/apps/integrations/public_urls.py`:

```python
from django.urls import path

urlpatterns: list = []
```

`backend/apps/integrations/internal_urls.py`:

```python
from django.urls import path

urlpatterns: list = []
```

En `backend/config/urls.py`, agregar dos rutas nuevas antes de `path("api/schema/", ...)`:

```python
    path("api/integrations/", include("apps.integrations.internal_urls")),
    path("api/public/v1/", include("apps.integrations.public_urls")),
```

- [ ] **Step 6: Verificar que el proyecto sigue arrancando**

Run: `cd backend && python manage.py check`
Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 7: Test del catálogo de scopes**

`backend/apps/integrations/tests/__init__.py`: vacío.

Create: `backend/apps/integrations/tests/test_scopes.py`

```python
import pytest

from apps.integrations.scopes import validate_scopes
from core import exceptions as domain_exceptions


def test_validate_scopes_accepts_known_scopes():
    validate_scopes(["customers:read", "appointments:write"])


def test_validate_scopes_rejects_unknown_scope():
    with pytest.raises(domain_exceptions.ValidationError) as exc_info:
        validate_scopes(["customers:read", "not_a_scope"])
    assert exc_info.value.details["invalid_scopes"] == ["not_a_scope"]
```

Run: `cd backend && pytest apps/integrations/tests/test_scopes.py -v`
Expected: 2 passed.

- [ ] **Step 8: Commit**

```bash
git add backend/pyproject.toml backend/apps/integrations backend/config/settings/base.py backend/config/urls.py
git commit -m "feat(integrations): scaffold de la app y catálogo de scopes de la API pública"
```

---

## Task 2: Modelos `ApiKey` y `OAuthClient`

**Files:**
- Create: `backend/apps/integrations/models.py`
- Create: `backend/apps/integrations/migrations/0001_initial.py` (generada, no escrita a mano)
- Create: `backend/apps/integrations/admin.py`
- Create: `backend/apps/integrations/tests/test_models.py`

**Interfaces:**
- Produces: `apps.integrations.models.CredentialStatus` (`ACTIVE`/`REVOKED`), `apps.integrations.models.ApiKey` (campos: `id`, `organization`, `name`, `prefix`, `secret_hash`, `scopes`, `status`, `created_by_user`, `last_used_at`, `revoked_at`), `apps.integrations.models.OAuthClient` (campos: `id`, `organization`, `name`, `client_id`, `client_secret_hash`, `scopes`, `status`, `created_by_user`, `revoked_at`), `ApiKey.generate(*, organization, name, scopes, created_by_user=None) -> tuple[ApiKey, str]` (devuelve la instancia y el secreto completo EN CLARO, una sola vez), `OAuthClient.generate(*, organization, name, scopes, created_by_user=None) -> tuple[OAuthClient, str]` (ídem, devuelve `client_secret` en claro).

- [ ] **Step 1: Escribir los modelos**

`backend/apps/integrations/models.py`:

```python
from __future__ import annotations

import secrets
import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.db import models

from apps.integrations.scopes import validate_scopes
from core.models import TimeStampedModel


class CredentialStatus(models.TextChoices):
    ACTIVE = "active", "Activa"
    REVOKED = "revoked", "Revocada"


def _generate_prefix() -> str:
    return secrets.token_hex(4)


def _generate_secret() -> str:
    return secrets.token_urlsafe(32)


class ApiKey(TimeStampedModel):
    """Credencial server-to-server simple (docs/public-api.md).

    No hereda de `TenantAwareModel`: se busca por `prefix` ANTES de que
    exista un tenant en contexto (mismo motivo que `apps.users.models.User`,
    ver `core/models.py`).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="api_keys"
    )
    name = models.CharField(max_length=100)
    prefix = models.CharField(max_length=16, unique=True, editable=False)
    secret_hash = models.CharField(max_length=255, editable=False)
    scopes = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=CredentialStatus.choices, default=CredentialStatus.ACTIVE)
    created_by_user = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, related_name="+", null=True, blank=True
    )
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.prefix})"

    @classmethod
    def generate(cls, *, organization, name: str, scopes: list[str], created_by_user=None) -> tuple[ApiKey, str]:
        validate_scopes(scopes)
        secret = _generate_secret()
        prefix = _generate_prefix()
        while cls.objects.filter(prefix=prefix).exists():
            prefix = _generate_prefix()
        key = cls.objects.create(
            organization=organization,
            name=name,
            prefix=prefix,
            secret_hash=make_password(secret),
            scopes=scopes,
            created_by_user=created_by_user,
        )
        return key, f"{prefix}.{secret}"

    def verify_secret(self, secret: str) -> bool:
        return check_password(secret, self.secret_hash)

    @property
    def is_active(self) -> bool:
        return self.status == CredentialStatus.ACTIVE


class OAuthClient(TimeStampedModel):
    """Credencial OAuth2 client-credentials (docs/public-api.md). Mismo criterio que `ApiKey`."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization", on_delete=models.CASCADE, related_name="oauth_clients"
    )
    name = models.CharField(max_length=100)
    client_id = models.CharField(max_length=32, unique=True, editable=False)
    client_secret_hash = models.CharField(max_length=255, editable=False)
    scopes = models.JSONField(default=list)
    status = models.CharField(max_length=20, choices=CredentialStatus.choices, default=CredentialStatus.ACTIVE)
    created_by_user = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, related_name="+", null=True, blank=True
    )
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.client_id})"

    @classmethod
    def generate(cls, *, organization, name: str, scopes: list[str], created_by_user=None) -> tuple[OAuthClient, str]:
        validate_scopes(scopes)
        client_secret = _generate_secret()
        client_id = secrets.token_hex(8)
        while cls.objects.filter(client_id=client_id).exists():
            client_id = secrets.token_hex(8)
        client = cls.objects.create(
            organization=organization,
            name=name,
            client_id=client_id,
            client_secret_hash=make_password(client_secret),
            scopes=scopes,
            created_by_user=created_by_user,
        )
        return client, client_secret

    def verify_secret(self, client_secret: str) -> bool:
        return check_password(client_secret, self.client_secret_hash)

    @property
    def is_active(self) -> bool:
        return self.status == CredentialStatus.ACTIVE
```

- [ ] **Step 2: Registrar en el admin de Django**

`backend/apps/integrations/admin.py`:

```python
from django.contrib import admin

from apps.integrations.models import ApiKey, OAuthClient


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    list_display = ["name", "prefix", "organization", "status", "last_used_at", "created_at"]
    list_filter = ["status", "organization"]
    readonly_fields = ["prefix", "secret_hash", "created_at", "updated_at"]


@admin.register(OAuthClient)
class OAuthClientAdmin(admin.ModelAdmin):
    list_display = ["name", "client_id", "organization", "status", "created_at"]
    list_filter = ["status", "organization"]
    readonly_fields = ["client_id", "client_secret_hash", "created_at", "updated_at"]
```

- [ ] **Step 3: Generar y aplicar la migración**

Run: `cd backend && python manage.py makemigrations integrations`
Expected: crea `apps/integrations/migrations/0001_initial.py` con los modelos `ApiKey`, `OAuthClient`.

Run: `cd backend && python manage.py migrate integrations`
Expected: aplica sin errores contra Postgres.

- [ ] **Step 4: Tests de los modelos**

`backend/apps/integrations/tests/test_models.py`:

```python
import pytest

from apps.integrations.models import ApiKey, CredentialStatus, OAuthClient
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


def test_api_key_generate_returns_plaintext_secret_once(organization):
    key, plaintext = ApiKey.generate(organization=organization, name="Integración X", scopes=["customers:read"])
    assert plaintext.startswith(f"{key.prefix}.")
    assert key.secret_hash != plaintext
    assert key.status == CredentialStatus.ACTIVE


def test_api_key_verify_secret_roundtrip(organization):
    key, plaintext = ApiKey.generate(organization=organization, name="Integración X", scopes=["customers:read"])
    secret = plaintext.split(".", 1)[1]
    assert key.verify_secret(secret) is True
    assert key.verify_secret("secreto-incorrecto") is False


def test_api_key_generate_rejects_unknown_scope(organization):
    with pytest.raises(domain_exceptions.ValidationError):
        ApiKey.generate(organization=organization, name="X", scopes=["no_existe:read"])


def test_oauth_client_generate_and_verify(organization):
    client, secret = OAuthClient.generate(organization=organization, name="ERP tercero", scopes=["appointments:read"])
    assert client.verify_secret(secret) is True
    assert client.verify_secret("otro") is False
```

Run: `cd backend && pytest apps/integrations/tests/test_models.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/integrations/models.py backend/apps/integrations/admin.py backend/apps/integrations/migrations backend/apps/integrations/tests/test_models.py
git commit -m "feat(integrations): modelos ApiKey y OAuthClient con secreto hasheado"
```

---

## Task 3: Autenticación pública (`ApiKeyAuthentication`, `PublicJWTAuthentication`) + integración con el middleware de tenant

**Files:**
- Create: `backend/apps/integrations/authentication.py`
- Modify: `backend/core/middleware.py`
- Create: `backend/apps/integrations/tests/test_authentication.py`

**Interfaces:**
- Consumes: `apps.integrations.models.ApiKey`, `apps.integrations.models.OAuthClient` (Tarea 2).
- Produces: `apps.integrations.authentication.PublicApiPrincipal` (atributos: `is_authenticated=True`, `is_platform_superadmin=False`, `organization`, `organization_id`, `scopes: set[str]`, `credential_label: str` — usado en Tareas 5, 7, 9, 10, 11 para permisos/throttling/idempotencia/auditoría), `apps.integrations.authentication.resolve_public_credential(request) -> tuple[PublicApiPrincipal, ApiKey | OAuthClient] | None` (cachea el resultado en `request._public_api_auth`; re-lanza `AuthenticationFailed` cacheada si la primera resolución falló — evita verificar el hash del secreto dos veces por request), `apps.integrations.authentication.ApiKeyAuthentication`, `apps.integrations.authentication.PublicJWTAuthentication`, `apps.integrations.authentication.issue_oauth_access_token(client: OAuthClient) -> tuple[str, int]` (usado en Tarea 4).

- [ ] **Step 1: Escribir el módulo de autenticación**

`backend/apps/integrations/authentication.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import jwt
from django.conf import settings
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication

from apps.integrations.models import ApiKey, CredentialStatus, OAuthClient

PUBLIC_JWT_TOKEN_TYPE = "public_access"
PUBLIC_JWT_ALGORITHM = "HS256"
PUBLIC_JWT_LIFETIME_SECONDS = 900


@dataclass(frozen=True)
class PublicApiPrincipal:
    """Sustituye a `request.user` en la API pública. No es un `apps.users.models.User`."""

    organization: object
    scopes: frozenset[str]
    credential_label: str
    is_authenticated: bool = field(default=True, init=False)
    is_platform_superadmin: bool = field(default=False, init=False)

    @property
    def organization_id(self):
        return self.organization.id


def _principal_for(credential: ApiKey | OAuthClient, *, label_prefix: str) -> PublicApiPrincipal:
    return PublicApiPrincipal(
        organization=credential.organization,
        scopes=frozenset(credential.scopes),
        credential_label=f"{label_prefix}:{credential.id}",
    )


def _authenticate_api_key(request) -> tuple[PublicApiPrincipal, ApiKey] | None:
    header = request.headers.get("Authorization", "")
    if not header.startswith("ApiKey "):
        return None
    raw = header[len("ApiKey ") :].strip()
    if "." not in raw:
        raise exceptions.AuthenticationFailed("Formato de API Key inválido.")
    prefix, secret = raw.split(".", 1)
    key = ApiKey.objects.filter(prefix=prefix).first()
    if key is None or not key.verify_secret(secret):
        raise exceptions.AuthenticationFailed("API Key inválida.")
    if key.status != CredentialStatus.ACTIVE:
        raise exceptions.AuthenticationFailed("API Key revocada.")
    ApiKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())
    return _principal_for(key, label_prefix="apikey"), key


def _authenticate_oauth_bearer(request) -> tuple[PublicApiPrincipal, OAuthClient] | None:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[len("Bearer ") :].strip()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[PUBLIC_JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    if payload.get("token_type") != PUBLIC_JWT_TOKEN_TYPE:
        # No es uno de nuestros tokens de client-credentials (p. ej. es un
        # access token interno de simplejwt) — no es nuestro caso, no falla.
        return None
    client = OAuthClient.objects.filter(client_id=payload.get("client_id")).first()
    if client is None or client.status != CredentialStatus.ACTIVE:
        raise exceptions.AuthenticationFailed("Cliente OAuth inválido o revocado.")
    return _principal_for(client, label_prefix="oauth"), client


def resolve_public_credential(request):
    """Resuelve y cachea en `request` la credencial pública (API Key u OAuth).

    Se llama dos veces por request (una vez desde
    `core.middleware.CurrentOrganizationMiddleware`, otra desde la clase de
    autenticación de DRF dentro del ciclo de la view) — el caché evita
    verificar el hash del secreto (deliberadamente costoso, PBKDF2) dos
    veces. Un fallo de autenticación también se cachea (como la excepción
    misma) para poder re-lanzarlo idéntico la segunda vez.
    """

    if not hasattr(request, "_public_api_auth"):
        try:
            request._public_api_auth = _authenticate_api_key(request) or _authenticate_oauth_bearer(request)
        except exceptions.AuthenticationFailed as exc:
            request._public_api_auth = exc
    return request._public_api_auth


class ApiKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        cached = resolve_public_credential(request)
        if isinstance(cached, Exception):
            raise cached
        if cached is None:
            return None
        principal, credential = cached
        return (principal, credential) if isinstance(credential, ApiKey) else None


class PublicJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        cached = resolve_public_credential(request)
        if isinstance(cached, Exception):
            raise cached
        if cached is None:
            return None
        principal, credential = cached
        return (principal, credential) if isinstance(credential, OAuthClient) else None


def issue_oauth_access_token(client: OAuthClient) -> tuple[str, int]:
    now = datetime.now(tz=UTC)
    payload = {
        "client_id": client.client_id,
        "org_id": str(client.organization_id),
        "scope": " ".join(client.scopes),
        "token_type": PUBLIC_JWT_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=PUBLIC_JWT_LIFETIME_SECONDS)).timestamp()),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=PUBLIC_JWT_ALGORITHM)
    return token, PUBLIC_JWT_LIFETIME_SECONDS
```

- [ ] **Step 2: Enganchar la resolución de tenant en el middleware**

En `backend/core/middleware.py`, modificar `_resolve_organization_id` (al final del método, reemplazando el último bloque):

```python
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return getattr(user, "organization_id", None)

        return CurrentOrganizationMiddleware._resolve_public_api_organization_id(request)

    @staticmethod
    def _resolve_public_api_organization_id(request: HttpRequest) -> str | None:
        from apps.integrations.authentication import resolve_public_credential

        cached = resolve_public_credential(request)
        if cached is None or isinstance(cached, Exception):
            return None
        principal, _credential = cached
        return str(principal.organization_id)
```

(reemplaza únicamente el bloque final que hoy termina en `return None`; el resto del método — el intento de `JWTAuthentication` — no cambia).

- [ ] **Step 3: Tests de autenticación**

`backend/apps/integrations/tests/test_authentication.py`:

```python
import pytest
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.integrations.authentication import (
    ApiKeyAuthentication,
    PublicJWTAuthentication,
    issue_oauth_access_token,
)
from apps.integrations.models import ApiKey, CredentialStatus, OAuthClient

pytestmark = pytest.mark.django_db

factory = APIRequestFactory()


def _drf_request(headers: dict) -> Request:
    django_request = factory.get("/api/public/v1/customers/", **headers)
    return Request(django_request)


def test_api_key_authentication_succeeds_with_valid_key(organization):
    key, plaintext = ApiKey.generate(organization=organization, name="X", scopes=["customers:read"])
    request = _drf_request({"HTTP_AUTHORIZATION": f"ApiKey {plaintext}"})
    principal, credential = ApiKeyAuthentication().authenticate(request)
    assert credential == key
    assert principal.organization_id == organization.id
    assert principal.scopes == {"customers:read"}


def test_api_key_authentication_rejects_wrong_secret(organization):
    key, _plaintext = ApiKey.generate(organization=organization, name="X", scopes=["customers:read"])
    request = _drf_request({"HTTP_AUTHORIZATION": f"ApiKey {key.prefix}.secreto-falso"})
    with pytest.raises(Exception):
        ApiKeyAuthentication().authenticate(request)


def test_api_key_authentication_rejects_revoked_key(organization):
    key, plaintext = ApiKey.generate(organization=organization, name="X", scopes=["customers:read"])
    key.status = CredentialStatus.REVOKED
    key.save(update_fields=["status"])
    request = _drf_request({"HTTP_AUTHORIZATION": f"ApiKey {plaintext}"})
    with pytest.raises(Exception):
        ApiKeyAuthentication().authenticate(request)


def test_oauth_bearer_authentication_succeeds(organization):
    client, _secret = OAuthClient.generate(organization=organization, name="ERP", scopes=["appointments:read"])
    token, _expires_in = issue_oauth_access_token(client)
    request = _drf_request({"HTTP_AUTHORIZATION": f"Bearer {token}"})
    principal, credential = PublicJWTAuthentication().authenticate(request)
    assert credential == client
    assert principal.scopes == {"appointments:read"}


def test_api_key_and_oauth_authentication_share_single_resolution(organization, django_assert_num_queries):
    key, plaintext = ApiKey.generate(organization=organization, name="X", scopes=["customers:read"])
    request = _drf_request({"HTTP_AUTHORIZATION": f"ApiKey {plaintext}"})
    ApiKeyAuthentication().authenticate(request)
    # Segunda llamada (simula lo que hace PublicJWTAuthentication en la
    # misma request): no debe volver a tocar la base de datos ni re-hashear.
    with django_assert_num_queries(0):
        result = PublicJWTAuthentication().authenticate(request)
    assert result is None
```

Run: `cd backend && pytest apps/integrations/tests/test_authentication.py -v`
Expected: 5 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/integrations/authentication.py backend/core/middleware.py backend/apps/integrations/tests/test_authentication.py
git commit -m "feat(integrations): autenticacion por ApiKey y OAuth2 client-credentials"
```

---

## Task 4: Endpoint `POST /api/public/v1/oauth/token/`

**Files:**
- Create: `backend/apps/integrations/oauth_views.py`
- Modify: `backend/apps/integrations/public_urls.py`
- Create: `backend/apps/integrations/tests/test_oauth_token_view.py`

**Interfaces:**
- Consumes: `apps.integrations.authentication.issue_oauth_access_token` (Tarea 3), `apps.integrations.models.OAuthClient`.
- Produces: vista `TokenView` montada en `/api/public/v1/oauth/token/`.

- [ ] **Step 1: Escribir la vista**

`backend/apps/integrations/oauth_views.py`:

```python
from __future__ import annotations

from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.integrations.authentication import issue_oauth_access_token
from apps.integrations.models import CredentialStatus, OAuthClient
from core import exceptions as domain_exceptions


class TokenRequestSerializer(serializers.Serializer):
    grant_type = serializers.ChoiceField(choices=["client_credentials"])
    client_id = serializers.CharField()
    client_secret = serializers.CharField()


class TokenView(APIView):
    """`POST /api/public/v1/oauth/token/` — OAuth2 client-credentials (docs/public-api.md)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        payload = TokenRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        client = OAuthClient.objects.filter(client_id=data["client_id"]).first()
        if (
            client is None
            or client.status != CredentialStatus.ACTIVE
            or not client.verify_secret(data["client_secret"])
        ):
            raise domain_exceptions.PermissionDeniedError("Credenciales de cliente inválidas.")

        access_token, expires_in = issue_oauth_access_token(client)
        return Response(
            {
                "access_token": access_token,
                "token_type": "Bearer",
                "expires_in": expires_in,
                "scope": " ".join(client.scopes),
            }
        )
```

- [ ] **Step 2: Montar la ruta**

`backend/apps/integrations/public_urls.py` (reemplaza el contenido del stub de la Tarea 1):

```python
from django.urls import path

from apps.integrations.oauth_views import TokenView

urlpatterns = [
    path("oauth/token/", TokenView.as_view(), name="public-oauth-token"),
]
```

- [ ] **Step 3: Test**

`backend/apps/integrations/tests/test_oauth_token_view.py`:

```python
import pytest
from rest_framework.test import APIClient

from apps.integrations.models import CredentialStatus, OAuthClient

pytestmark = pytest.mark.django_db


def test_token_endpoint_issues_access_token_for_valid_credentials(organization):
    client, secret = OAuthClient.generate(organization=organization, name="ERP", scopes=["appointments:read"])
    response = APIClient().post(
        "/api/public/v1/oauth/token/",
        {"grant_type": "client_credentials", "client_id": client.client_id, "client_secret": secret},
    )
    assert response.status_code == 200
    assert response.data["token_type"] == "Bearer"
    assert response.data["scope"] == "appointments:read"


def test_token_endpoint_rejects_wrong_secret(organization):
    client, _secret = OAuthClient.generate(organization=organization, name="ERP", scopes=["appointments:read"])
    response = APIClient().post(
        "/api/public/v1/oauth/token/",
        {"grant_type": "client_credentials", "client_id": client.client_id, "client_secret": "malo"},
    )
    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"


def test_token_endpoint_rejects_revoked_client(organization):
    client, secret = OAuthClient.generate(organization=organization, name="ERP", scopes=["appointments:read"])
    client.status = CredentialStatus.REVOKED
    client.save(update_fields=["status"])
    response = APIClient().post(
        "/api/public/v1/oauth/token/",
        {"grant_type": "client_credentials", "client_id": client.client_id, "client_secret": secret},
    )
    assert response.status_code == 403
```

Run: `cd backend && pytest apps/integrations/tests/test_oauth_token_view.py -v`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/integrations/oauth_views.py backend/apps/integrations/public_urls.py backend/apps/integrations/tests/test_oauth_token_view.py
git commit -m "feat(integrations): endpoint de token OAuth2 client-credentials"
```

---

## Task 5: `HasScope`, `PublicApiRateThrottle`, `PublicApiPagination`, `PublicApiBaseViewSet`

**Files:**
- Create: `backend/apps/integrations/permissions.py`
- Create: `backend/apps/integrations/throttling.py`
- Create: `backend/apps/integrations/pagination.py`
- Create: `backend/apps/integrations/views_base.py`
- Create: `backend/apps/integrations/tests/test_permissions_and_throttling.py`

**Interfaces:**
- Consumes: `apps.integrations.authentication.PublicApiPrincipal` (Tarea 3).
- Produces: `HasScope(scope)`, `PublicApiRateThrottle`, `PublicApiPagination`, `PublicApiBaseViewSet` — usados por todos los viewsets de recursos (Tareas 8, 9, 10, 11).

- [ ] **Step 1: Permiso por scope**

`backend/apps/integrations/permissions.py`:

```python
from __future__ import annotations

from rest_framework.permissions import BasePermission


class HasScope(BasePermission):
    """Exige que la credencial autenticada declare el scope indicado.

    Uso: `permission_classes = [HasScope("customers:write")]`.
    """

    def __init__(self, scope: str | None = None):
        self.scope = scope

    def __call__(self):
        return self

    def has_permission(self, request, view) -> bool:
        scope = self.scope or getattr(view, "required_scope", None)
        principal = request.user
        if not (principal and getattr(principal, "is_authenticated", False)):
            return False
        if scope is None:
            return True
        return scope in getattr(principal, "scopes", frozenset())
```

- [ ] **Step 2: Rate limiting por credencial, configurable por organización**

`backend/apps/integrations/throttling.py`:

```python
from __future__ import annotations

import time

from rest_framework.throttling import SimpleRateThrottle

DEFAULT_PUBLIC_API_RATE_PER_MINUTE = 60


class PublicApiRateThrottle(SimpleRateThrottle):
    """60 req/min por defecto; configurable por organización vía
    `Organization.settings["public_api_plan"]["rate_per_minute"]`
    (docs/public-api.md, sección "Preparación para suscripciones").
    """

    scope = "public_api"

    def get_cache_key(self, request, view):
        credential = getattr(request, "auth", None)
        if credential is None:
            return None
        self._configure_rate(credential)
        ident = f"{type(credential).__name__}:{credential.id}"
        return self.cache_format % {"scope": self.scope, "ident": ident}

    def _configure_rate(self, credential) -> None:
        plan = (credential.organization.settings or {}).get("public_api_plan", {})
        rate_per_minute = plan.get("rate_per_minute", DEFAULT_PUBLIC_API_RATE_PER_MINUTE)
        self.num_requests = rate_per_minute
        self.duration = 60

    def allow_request(self, request, view):
        allowed = super().allow_request(request, view)
        if getattr(self, "key", None) is not None:
            remaining = max(self.num_requests - len(self.history), 0)
            reset_in = int(self.duration - (time.time() - self.history[-1])) if self.history else self.duration
            request._public_rate_limit = {
                "limit": self.num_requests,
                "remaining": remaining,
                "reset": max(reset_in, 0),
            }
        return allowed
```

- [ ] **Step 3: Paginación con `X-Total-Count` y `page_size` máximo más bajo**

`backend/apps/integrations/pagination.py`:

```python
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class PublicApiPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50

    def get_paginated_response(self, data) -> Response:
        response = super().get_paginated_response(data)
        response["X-Total-Count"] = str(self.page.paginator.count)
        return response
```

- [ ] **Step 4: Viewset base con headers de rate limit**

`backend/apps/integrations/views_base.py`:

```python
from __future__ import annotations

from rest_framework.viewsets import GenericViewSet

from apps.integrations.authentication import ApiKeyAuthentication, PublicJWTAuthentication
from apps.integrations.pagination import PublicApiPagination
from apps.integrations.throttling import PublicApiRateThrottle


class PublicApiBaseViewSet(GenericViewSet):
    authentication_classes = [ApiKeyAuthentication, PublicJWTAuthentication]
    throttle_classes = [PublicApiRateThrottle]
    pagination_class = PublicApiPagination

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        rate_info = getattr(request, "_public_rate_limit", None)
        if rate_info:
            response["X-RateLimit-Limit"] = str(rate_info["limit"])
            response["X-RateLimit-Remaining"] = str(rate_info["remaining"])
            response["X-RateLimit-Reset"] = str(rate_info["reset"])
            if response.status_code == 429:
                response["Retry-After"] = str(rate_info["reset"])
        return response
```

- [ ] **Step 5: Tests**

`backend/apps/integrations/tests/test_permissions_and_throttling.py`:

```python
import pytest
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.integrations.authentication import PublicApiPrincipal
from apps.integrations.permissions import HasScope

pytestmark = pytest.mark.django_db

factory = APIRequestFactory()


class _Anon:
    is_authenticated = False


def test_has_scope_denies_unauthenticated_principal():
    request = Request(factory.get("/"))
    request._user = _Anon()
    assert HasScope("customers:read").has_permission(request, view=None) is False


def test_has_scope_allows_when_scope_present(organization):
    principal = PublicApiPrincipal(organization=organization, scopes=frozenset({"customers:read"}), credential_label="apikey:x")
    request = Request(factory.get("/"))
    request._user = principal
    assert HasScope("customers:read").has_permission(request, view=None) is True


def test_has_scope_denies_when_scope_missing(organization):
    principal = PublicApiPrincipal(organization=organization, scopes=frozenset({"customers:read"}), credential_label="apikey:x")
    request = Request(factory.get("/"))
    request._user = principal
    assert HasScope("customers:write").has_permission(request, view=None) is False
```

Run: `cd backend && pytest apps/integrations/tests/test_permissions_and_throttling.py -v`
Expected: 3 passed. (El rate limiting real, de punta a punta con headers y 429, se cubre con tests de integración en la Tarea 9 una vez exista al menos un endpoint público real).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/integrations/permissions.py backend/apps/integrations/throttling.py backend/apps/integrations/pagination.py backend/apps/integrations/views_base.py backend/apps/integrations/tests/test_permissions_and_throttling.py
git commit -m "feat(integrations): HasScope, rate limiting configurable por organizacion y paginacion publica"
```

---

## Task 6: Endpoints internos de administración de credenciales (`/api/integrations/`)

**Files:**
- Create: `backend/apps/integrations/admin_serializers.py`
- Create: `backend/apps/integrations/admin_views.py`
- Modify: `backend/apps/integrations/internal_urls.py`
- Modify: `backend/apps/users/permissions_catalog.py`
- Create: `backend/apps/integrations/tests/test_admin_views.py`

**Interfaces:**
- Consumes: `apps.integrations.models.ApiKey`, `apps.integrations.models.OAuthClient` (Tarea 2), `apps.audit.services.log_action`, `core.permissions.HasPermission`.
- Produces: `ApiKeyAdminViewSet`, `OAuthClientAdminViewSet` bajo `/api/integrations/api-keys/` y `/api/integrations/oauth-clients/`, nuevo permiso `integrations:manage`.

- [ ] **Step 1: Agregar el permiso al catálogo**

En `backend/apps/users/permissions_catalog.py`, agregar a `PERMISSIONS`:

```python
    ("integrations:manage", "Crear, listar y revocar credenciales de la API pública de integración"),
```

Y agregar `"integrations:manage",` a la lista de `ROLE_PERMISSIONS[SystemRoleCode.ORG_ADMIN]` (solo Admin — mismo criterio que `users:write`, es gestión de acceso de terceros al tenant).

Run: `cd backend && python manage.py seed_rbac`
Expected: corre sin error (idempotente, ya se usa en otras fases vía el fixture `system_roles`).

- [ ] **Step 2: Serializers de administración**

`backend/apps/integrations/admin_serializers.py`:

```python
from __future__ import annotations

from rest_framework import serializers

from apps.integrations.models import ApiKey, OAuthClient


class ApiKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApiKey
        fields = ["id", "name", "prefix", "scopes", "status", "last_used_at", "revoked_at", "created_at"]
        read_only_fields = fields


class CreateApiKeySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    scopes = serializers.ListField(child=serializers.CharField(), allow_empty=False)


class OAuthClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = OAuthClient
        fields = ["id", "name", "client_id", "scopes", "status", "revoked_at", "created_at"]
        read_only_fields = fields


class CreateOAuthClientSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    scopes = serializers.ListField(child=serializers.CharField(), allow_empty=False)
```

- [ ] **Step 2: Vistas**

`backend/apps/integrations/admin_views.py`:

```python
from __future__ import annotations

from rest_framework.mixins import CreateModelMixin, ListModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.audit.models import AuditAction
from apps.audit.services import log_action
from apps.integrations.admin_serializers import (
    ApiKeySerializer,
    CreateApiKeySerializer,
    CreateOAuthClientSerializer,
    OAuthClientSerializer,
)
from apps.integrations.models import ApiKey, CredentialStatus, OAuthClient
from core.permissions import HasPermission


class ApiKeyAdminViewSet(CreateModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = ApiKeySerializer
    permission_classes = [HasPermission("integrations:manage")]

    def get_queryset(self):
        return ApiKey.objects.filter(organization=self.request.user.organization)

    def create(self, request, *args, **kwargs):
        payload = CreateApiKeySerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        key, plaintext = ApiKey.generate(
            organization=request.user.organization,
            name=payload.validated_data["name"],
            scopes=payload.validated_data["scopes"],
            created_by_user=request.user,
        )
        log_action(
            action=AuditAction.CREATE,
            entity_type="ApiKey",
            entity_id=str(key.id),
            organization=request.user.organization,
            user=request.user,
            changes={"name": key.name, "scopes": key.scopes},
        )
        data = ApiKeySerializer(key).data
        data["secret"] = plaintext
        return Response(data, status=201)

    def destroy(self, request, *args, **kwargs):
        key = self.get_object()
        key.status = CredentialStatus.REVOKED
        from django.utils import timezone

        key.revoked_at = timezone.now()
        key.save(update_fields=["status", "revoked_at"])
        log_action(
            action=AuditAction.UPDATE,
            entity_type="ApiKey",
            entity_id=str(key.id),
            organization=request.user.organization,
            user=request.user,
            changes={"status": "revoked"},
        )
        return Response(status=204)


class OAuthClientAdminViewSet(CreateModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = OAuthClientSerializer
    permission_classes = [HasPermission("integrations:manage")]

    def get_queryset(self):
        return OAuthClient.objects.filter(organization=self.request.user.organization)

    def create(self, request, *args, **kwargs):
        payload = CreateOAuthClientSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        client, secret = OAuthClient.generate(
            organization=request.user.organization,
            name=payload.validated_data["name"],
            scopes=payload.validated_data["scopes"],
            created_by_user=request.user,
        )
        log_action(
            action=AuditAction.CREATE,
            entity_type="OAuthClient",
            entity_id=str(client.id),
            organization=request.user.organization,
            user=request.user,
            changes={"name": client.name, "scopes": client.scopes},
        )
        data = OAuthClientSerializer(client).data
        data["client_secret"] = secret
        return Response(data, status=201)

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        client.status = CredentialStatus.REVOKED
        from django.utils import timezone

        client.revoked_at = timezone.now()
        client.save(update_fields=["status", "revoked_at"])
        log_action(
            action=AuditAction.UPDATE,
            entity_type="OAuthClient",
            entity_id=str(client.id),
            organization=request.user.organization,
            user=request.user,
            changes={"status": "revoked"},
        )
        return Response(status=204)
```

Nota: `destroy` no está en `CreateModelMixin`/`ListModelMixin` — hay que agregar `from rest_framework.mixins import DestroyModelMixin` y heredar de él también en ambas clases (`class ApiKeyAdminViewSet(CreateModelMixin, ListModelMixin, DestroyModelMixin, GenericViewSet):`).

- [ ] **Step 3: Rutas**

`backend/apps/integrations/internal_urls.py` (reemplaza el stub):

```python
from rest_framework.routers import DefaultRouter

from apps.integrations.admin_views import ApiKeyAdminViewSet, OAuthClientAdminViewSet

router = DefaultRouter()
router.register("api-keys", ApiKeyAdminViewSet, basename="api-key-admin")
router.register("oauth-clients", OAuthClientAdminViewSet, basename="oauth-client-admin")

urlpatterns = router.urls
```

- [ ] **Step 4: Tests**

`backend/apps/integrations/tests/test_admin_views.py`:

```python
import pytest

from apps.integrations.models import ApiKey, CredentialStatus

pytestmark = pytest.mark.django_db


def test_create_api_key_returns_plaintext_secret_once(auth_client):
    response = auth_client.post(
        "/api/integrations/api-keys/", {"name": "Integración X", "scopes": ["customers:read"]}, format="json"
    )
    assert response.status_code == 201
    assert "secret" in response.data
    assert response.data["secret"].startswith(response.data["prefix"] + ".")


def test_list_api_keys_never_exposes_secret(auth_client, organization):
    ApiKey.generate(organization=organization, name="X", scopes=["customers:read"])
    response = auth_client.get("/api/integrations/api-keys/")
    assert response.status_code == 200
    assert all("secret" not in row and "secret_hash" not in row for row in response.data["results"])


def test_revoke_api_key(auth_client, organization):
    key, _plaintext = ApiKey.generate(organization=organization, name="X", scopes=["customers:read"])
    response = auth_client.delete(f"/api/integrations/api-keys/{key.id}/")
    assert response.status_code == 204
    key.refresh_from_db()
    assert key.status == CredentialStatus.REVOKED


def test_reception_role_cannot_manage_credentials(api_client, organization, system_roles, make_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    reception = make_user(organization, "recepcion@test.com", roles=["reception"])
    token = RefreshToken.for_user(reception)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    response = api_client.post("/api/integrations/api-keys/", {"name": "X", "scopes": ["customers:read"]}, format="json")
    assert response.status_code == 403


def test_api_key_admin_only_lists_own_organization_keys(auth_client, organization, other_organization):
    ApiKey.generate(organization=other_organization, name="Ajena", scopes=["customers:read"])
    ApiKey.generate(organization=organization, name="Propia", scopes=["customers:read"])
    response = auth_client.get("/api/integrations/api-keys/")
    names = [row["name"] for row in response.data["results"]]
    assert names == ["Propia"]
```

Run: `cd backend && pytest apps/integrations/tests/test_admin_views.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/integrations/admin_serializers.py backend/apps/integrations/admin_views.py backend/apps/integrations/internal_urls.py backend/apps/users/permissions_catalog.py backend/apps/integrations/tests/test_admin_views.py
git commit -m "feat(integrations): endpoints internos de administracion de credenciales"
```

---

## Task 7: Idempotencia (`IdempotencyKey` + `IdempotentCreateMixin`)

**Files:**
- Modify: `backend/apps/integrations/models.py`
- Create: `backend/apps/integrations/migrations/0002_idempotencykey.py` (generada)
- Create: `backend/apps/integrations/idempotency.py`
- Modify: `backend/config/settings/base.py` (tarea de limpieza en `CELERY_BEAT_SCHEDULE`)
- Create: `backend/apps/integrations/tasks.py`
- Create: `backend/apps/integrations/tests/test_idempotency.py`

**Interfaces:**
- Produces: `apps.integrations.models.IdempotencyKey`, `apps.integrations.idempotency.IdempotentCreateMixin` (usado en Tareas 9 y 10), `apps.integrations.tasks.cleanup_expired_idempotency_keys`.

- [ ] **Step 1: Modelo**

Agregar a `backend/apps/integrations/models.py` (al final del archivo):

```python
from core.models import TenantAwareModel  # agregar a los imports existentes


class IdempotencyKey(TenantAwareModel, TimeStampedModel):
    """`(credential, key, endpoint) -> respuesta guardada`, ventana de 24h (docs/public-api.md)."""

    credential_label = models.CharField(max_length=64)
    key = models.CharField(max_length=255)
    endpoint = models.CharField(max_length=255)
    response_status = models.PositiveSmallIntegerField()
    response_body = models.JSONField(default=dict)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "credential_label", "key", "endpoint"],
                name="unique_idempotency_key_per_credential_endpoint",
            )
        ]
        indexes = [models.Index(fields=["created_at"])]
```

- [ ] **Step 2: Migración**

Run: `cd backend && python manage.py makemigrations integrations`
Expected: crea `0002_idempotencykey.py` (o el nombre que Django elija).

Run: `cd backend && python manage.py migrate integrations`

- [ ] **Step 3: Mixin de idempotencia**

`backend/apps/integrations/idempotency.py`:

```python
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework.response import Response

from apps.integrations.models import IdempotencyKey

IDEMPOTENCY_WINDOW = timedelta(hours=24)
IDEMPOTENCY_HEADER = "Idempotency-Key"


class IdempotentCreateMixin:
    """Reintentos de red seguros en `create()`: misma `Idempotency-Key` → misma respuesta, sin re-ejecutar el efecto."""

    def create(self, request, *args, **kwargs):
        idempotency_key = request.headers.get(IDEMPOTENCY_HEADER)
        if not idempotency_key:
            return super().create(request, *args, **kwargs)

        credential = request.auth
        cutoff = timezone.now() - IDEMPOTENCY_WINDOW
        existing = IdempotencyKey.objects.filter(
            organization=credential.organization,
            credential_label=request.user.credential_label,
            key=idempotency_key,
            endpoint=request.path,
            created_at__gte=cutoff,
        ).first()
        if existing is not None:
            return Response(existing.response_body, status=existing.response_status)

        response = super().create(request, *args, **kwargs)
        if response.status_code < 400:
            IdempotencyKey.objects.create(
                organization=credential.organization,
                credential_label=request.user.credential_label,
                key=idempotency_key,
                endpoint=request.path,
                response_status=response.status_code,
                response_body=response.data,
            )
        return response
```

- [ ] **Step 4: Tarea de limpieza (Celery beat, cada 6 horas)**

`backend/apps/integrations/tasks.py`:

```python
from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.integrations.idempotency import IDEMPOTENCY_WINDOW
from apps.integrations.models import IdempotencyKey


@shared_task(name="integrations.cleanup_expired_idempotency_keys")
def cleanup_expired_idempotency_keys() -> int:
    cutoff = timezone.now() - IDEMPOTENCY_WINDOW - timedelta(hours=1)
    deleted, _ = IdempotencyKey.all_objects.filter(created_at__lt=cutoff).delete()
    return deleted
```

En `backend/config/settings/base.py`, agregar a `CELERY_BEAT_SCHEDULE`:

```python
    "cleanup-expired-idempotency-keys": {
        "task": "integrations.cleanup_expired_idempotency_keys",
        "schedule": crontab(minute=0, hour="*/6"),
    },
```

- [ ] **Step 5: Tests**

`backend/apps/integrations/tests/test_idempotency.py`:

```python
import pytest
from rest_framework.mixins import CreateModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.integrations.idempotency import IdempotentCreateMixin, cleanup_expired_idempotency_keys_helper  # noqa
```

Reemplazar por un test funcional real usando un recurso ya construido en la Tarea 9 no es posible todavía (orden de tareas); en su lugar, testear el mixin de forma aislada con un viewset mínimo de prueba:

```python
import pytest
from rest_framework.mixins import CreateModelMixin
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.viewsets import GenericViewSet

from apps.integrations.authentication import PublicApiPrincipal
from apps.integrations.idempotency import IdempotentCreateMixin
from apps.integrations.models import ApiKey, IdempotencyKey

pytestmark = pytest.mark.django_db

_call_count = {"value": 0}


class _EchoViewSet(IdempotentCreateMixin, CreateModelMixin, GenericViewSet):
    def get_queryset(self):
        return IdempotencyKey.objects.none()

    def create(self, request, *args, **kwargs):
        _call_count["value"] += 1
        return Response({"created": _call_count["value"]}, status=201)


def _authenticated_request(organization, headers):
    factory = APIRequestFactory()
    key, _plaintext = ApiKey.generate(organization=organization, name="X", scopes=[])
    principal = PublicApiPrincipal(organization=organization, scopes=frozenset(), credential_label=f"apikey:{key.id}")
    request = factory.post("/api/public/v1/appointments/", {}, format="json", **headers)
    force_authenticate(request, user=principal, token=key)
    from rest_framework.request import Request

    drf_request = Request(request)
    drf_request._user = principal
    drf_request._auth = key
    return drf_request


def test_idempotent_create_returns_same_response_on_repeat(organization):
    _call_count["value"] = 0
    view = _EchoViewSet.as_view({"post": "create"})
    headers = {"HTTP_IDEMPOTENCY_KEY": "abc-123"}

    request1 = _authenticated_request(organization, headers)
    response1 = view(request1)
    request2 = _authenticated_request(organization, headers)
    response2 = view(request2)

    assert response1.data == {"created": 1}
    assert response2.data == {"created": 1}
    assert _call_count["value"] == 1


def test_without_idempotency_header_executes_every_time(organization):
    _call_count["value"] = 0
    view = _EchoViewSet.as_view({"post": "create"})

    view(_authenticated_request(organization, {}))
    view(_authenticated_request(organization, {}))

    assert _call_count["value"] == 2
```

Run: `cd backend && pytest apps/integrations/tests/test_idempotency.py -v`
Expected: 2 passed.

(Nota para quien implemente: `force_authenticate` con un objeto `Request` envuelto requiere setear `_user`/`_auth` directamente como se muestra arriba — DRF `force_authenticate` solo funciona bien sobre el `HttpRequest` crudo antes de envolver en `Request`; verificar en la ejecución real y ajustar si `request.auth`/`request.user` no quedan seteados como se espera, dejando el test en verde antes de continuar.)

- [ ] **Step 6: Commit**

```bash
git add backend/apps/integrations/models.py backend/apps/integrations/migrations backend/apps/integrations/idempotency.py backend/apps/integrations/tasks.py backend/config/settings/base.py backend/apps/integrations/tests/test_idempotency.py
git commit -m "feat(integrations): idempotencia de escrituras publicas con Idempotency-Key"
```

---

## Task 8: Recursos públicos de solo/mayormente-lectura — clientes, servicios, disponibilidad

**Files:**
- Create: `backend/apps/integrations/resource_views.py`
- Modify: `backend/apps/integrations/public_urls.py`
- Create: `backend/apps/integrations/tests/test_public_customers.py`
- Create: `backend/apps/integrations/tests/test_public_services_and_availability.py`

**Interfaces:**
- Consumes: `apps.customers.models.Customer`, `apps.customers.serializers.CustomerSerializer`, `apps.services.models.Service`, `apps.services.serializers.ServiceSerializer`, `apps.scheduling.engine.get_available_slots`, `apps.scheduling.serializers.AvailabilityQuerySerializer`, `apps.scheduling.serializers.AvailabilitySlotSerializer` — todos reutilizados sin cambios, `apps.integrations.views_base.PublicApiBaseViewSet`, `apps.integrations.permissions.HasScope`.
- Produces: `CustomerPublicViewSet`, `ServicePublicViewSet`, `AvailabilityPublicView`, montados bajo `/api/public/v1/customers/`, `/api/public/v1/services/`, `/api/public/v1/availability/`.

- [ ] **Step 1: Vistas**

`backend/apps/integrations/resource_views.py`:

```python
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from rest_framework.generics import GenericAPIView
from rest_framework.mixins import (
    CreateModelMixin,
    ListModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
)
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.customers.models import Customer
from apps.customers.serializers import CustomerSerializer
from apps.integrations.permissions import HasScope
from apps.integrations.views_base import PublicApiBaseViewSet
from apps.scheduling.serializers import AvailabilityQuerySerializer, AvailabilitySlotSerializer
from apps.scheduling.engine import get_available_slots
from apps.services.models import Service, ServiceStatus
from apps.services.serializers import ServiceSerializer
from core import exceptions as domain_exceptions


class CustomerPublicViewSet(
    CreateModelMixin, RetrieveModelMixin, UpdateModelMixin, ListModelMixin, PublicApiBaseViewSet
):
    serializer_class = CustomerSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "document_number": ["exact"]}
    ordering_fields = ["last_name", "first_name", "registered_at"]
    ordering = ["last_name", "first_name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update"):
            return [HasScope("customers:write")]
        return [HasScope("customers:read")]

    def get_queryset(self):
        return Customer.objects.all()


class ServicePublicViewSet(ListModelMixin, PublicApiBaseViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [HasScope("services:read")]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "category": ["exact"]}
    ordering_fields = ["name", "price"]
    ordering = ["name"]

    def get_queryset(self):
        return Service.objects.filter(status=ServiceStatus.ACTIVE)


class AvailabilityPublicView(GenericAPIView):
    permission_classes = [HasScope("availability:read")]
    authentication_classes = PublicApiBaseViewSet.authentication_classes
    throttle_classes = PublicApiBaseViewSet.throttle_classes

    def get(self, request):
        query = AvailabilityQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data

        service = Service.objects.filter(id=data["service_id"]).first()
        if service is None:
            raise domain_exceptions.NotFoundError("El servicio indicado no existe.")

        employee_id = data.get("employee_id")
        slots = get_available_slots(
            organization_id=str(request.user.organization_id),
            branch_id=str(data["branch_id"]),
            service_duration_minutes=service.duration_minutes,
            target_date=data["date"],
            employee_id=str(employee_id) if employee_id else None,
        )
        slot_dicts = [
            {"employee_id": s.employee_id, "start_time": s.start_time, "end_time": s.end_time} for s in slots
        ]
        return Response(
            {
                "service_id": str(data["service_id"]),
                "branch_id": str(data["branch_id"]),
                "date": str(data["date"]),
                "slots": AvailabilitySlotSerializer(slot_dicts, many=True).data,
            }
        )
```

- [ ] **Step 2: Rutas**

`backend/apps/integrations/public_urls.py` (agregar al existente):

```python
from rest_framework.routers import DefaultRouter

from apps.integrations.oauth_views import TokenView
from apps.integrations.resource_views import AvailabilityPublicView, CustomerPublicViewSet, ServicePublicViewSet

router = DefaultRouter()
router.register("customers", CustomerPublicViewSet, basename="public-customer")
router.register("services", ServicePublicViewSet, basename="public-service")

urlpatterns = [
    path("oauth/token/", TokenView.as_view(), name="public-oauth-token"),
    path("availability/", AvailabilityPublicView.as_view(), name="public-availability"),
] + router.urls
```

(agregar `from django.urls import path` al import existente).

- [ ] **Step 3: Tests — clientes (incluye aislamiento entre organizaciones)**

`backend/apps/integrations/tests/test_public_customers.py`:

```python
import pytest

from apps.customers.models import Customer
from apps.integrations.models import ApiKey

pytestmark = pytest.mark.django_db


def _client_with_key(organization, scopes):
    from rest_framework.test import APIClient

    _key, plaintext = ApiKey.generate(organization=organization, name="Test", scopes=scopes)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"ApiKey {plaintext}")
    return client


def test_list_customers_only_returns_own_organization(organization, other_organization):
    Customer.objects.create(organization=organization, first_name="Ana", last_name="Pérez")
    Customer.objects.create(organization=other_organization, first_name="Luis", last_name="Gómez")

    response = _client_with_key(organization, ["customers:read"]).get("/api/public/v1/customers/")
    assert response.status_code == 200
    names = [row["first_name"] for row in response.data["results"]]
    assert names == ["Ana"]
    assert response["X-Total-Count"] == "1"


def test_create_customer_requires_write_scope(organization):
    response = _client_with_key(organization, ["customers:read"]).post(
        "/api/public/v1/customers/", {"first_name": "Nuevo", "last_name": "Cliente"}, format="json"
    )
    assert response.status_code == 403


def test_create_customer_with_write_scope_assigns_credential_organization(organization):
    response = _client_with_key(organization, ["customers:write"]).post(
        "/api/public/v1/customers/", {"first_name": "Nuevo", "last_name": "Cliente"}, format="json"
    )
    assert response.status_code == 201
    customer = Customer.objects.get(id=response.data["id"])
    assert customer.organization_id == organization.id


def test_request_without_credentials_is_rejected(organization):
    from rest_framework.test import APIClient

    response = APIClient().get("/api/public/v1/customers/")
    assert response.status_code in (401, 403)


def test_response_includes_rate_limit_headers(organization):
    response = _client_with_key(organization, ["customers:read"]).get("/api/public/v1/customers/")
    assert "X-RateLimit-Limit" in response
    assert "X-RateLimit-Remaining" in response
```

Run: `cd backend && pytest apps/integrations/tests/test_public_customers.py -v`
Expected: 5 passed.

- [ ] **Step 4: Tests — servicios y disponibilidad**

`backend/apps/integrations/tests/test_public_services_and_availability.py`:

```python
import pytest

from apps.integrations.models import ApiKey
from apps.services.models import Service, ServiceStatus

pytestmark = pytest.mark.django_db


def _client_with_key(organization, scopes):
    from rest_framework.test import APIClient

    _key, plaintext = ApiKey.generate(organization=organization, name="Test", scopes=scopes)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"ApiKey {plaintext}")
    return client


def test_list_services_only_returns_active(organization):
    Service.objects.create(organization=organization, name="Corte", duration_minutes=30, price=10, status=ServiceStatus.ACTIVE)
    Service.objects.create(organization=organization, name="Inactivo", duration_minutes=30, price=10, status=ServiceStatus.INACTIVE)

    response = _client_with_key(organization, ["services:read"]).get("/api/public/v1/services/")
    names = [row["name"] for row in response.data["results"]]
    assert names == ["Corte"]


def test_availability_requires_scope(organization):
    response = _client_with_key(organization, ["services:read"]).get(
        "/api/public/v1/availability/?service_id=00000000-0000-0000-0000-000000000000&branch_id=00000000-0000-0000-0000-000000000000&date=2026-09-01"
    )
    assert response.status_code == 403


def test_availability_returns_not_found_for_missing_service(organization):
    response = _client_with_key(organization, ["availability:read"]).get(
        "/api/public/v1/availability/?service_id=00000000-0000-0000-0000-000000000000&branch_id=00000000-0000-0000-0000-000000000000&date=2026-09-01"
    )
    assert response.status_code == 404
```

Run: `cd backend && pytest apps/integrations/tests/test_public_services_and_availability.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/integrations/resource_views.py backend/apps/integrations/public_urls.py backend/apps/integrations/tests/test_public_customers.py backend/apps/integrations/tests/test_public_services_and_availability.py
git commit -m "feat(integrations): recursos publicos de clientes, servicios y disponibilidad"
```

---

## Task 9: Recurso público de citas (con idempotencia y cancelación)

**Files:**
- Create: `backend/apps/integrations/appointment_views.py`
- Modify: `backend/apps/integrations/public_urls.py`
- Create: `backend/apps/integrations/tests/test_public_appointments.py`

**Interfaces:**
- Consumes: `apps.appointments.serializers.{AppointmentSerializer,CreateAppointmentSerializer,CancelAppointmentSerializer}`, `apps.appointments.services.{CreateAppointmentUseCase,CreateAppointmentRequest,TransitionAppointmentUseCase}`, `apps.appointments.models.{Appointment,AppointmentStatus}`, `apps.integrations.idempotency.IdempotentCreateMixin` (Tarea 7).
- Produces: `AppointmentPublicViewSet` bajo `/api/public/v1/appointments/`.

- [ ] **Step 1: Vista**

`backend/apps/integrations/appointment_views.py`:

```python
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response

from apps.appointments.models import Appointment, AppointmentStatus
from apps.appointments.serializers import (
    AppointmentSerializer,
    CancelAppointmentSerializer,
    CreateAppointmentSerializer,
)
from apps.appointments.services import CreateAppointmentRequest, CreateAppointmentUseCase, TransitionAppointmentUseCase
from apps.integrations.idempotency import IdempotentCreateMixin
from apps.integrations.permissions import HasScope
from apps.integrations.views_base import PublicApiBaseViewSet


class AppointmentPublicViewSet(
    IdempotentCreateMixin, CreateModelMixin, RetrieveModelMixin, ListModelMixin, PublicApiBaseViewSet
):
    serializer_class = AppointmentSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {
        "status": ["exact"],
        "customer": ["exact"],
        "appointment_date": ["exact", "gte", "lte"],
    }
    ordering_fields = ["appointment_date", "start_time"]
    ordering = ["appointment_date", "start_time"]

    def get_permissions(self):
        if self.action in ("create", "cancel"):
            return [HasScope("appointments:write")]
        return [HasScope("appointments:read")]

    def get_queryset(self):
        return Appointment.objects.all()

    def create(self, request, *args, **kwargs):
        payload = CreateAppointmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CreateAppointmentUseCase(organization=request.user.organization)
        appointment = use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(data["customer_id"]),
                service_id=str(data["service_id"]),
                employee_id=str(data["employee_id"]),
                branch_id=str(data["branch_id"]),
                appointment_date=data["appointment_date"],
                start_time=data["start_time"],
                notes=data.get("notes", ""),
                booking_channel="api",
                requires_confirmation=data.get("requires_confirmation", False),
            )
        )
        return Response(AppointmentSerializer(appointment).data, status=201)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        payload = CancelAppointmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        use_case = TransitionAppointmentUseCase(actor_user=None)
        use_case.transition(
            appointment, AppointmentStatus.CANCELLED, reason=payload.validated_data.get("reason", "")
        )
        return Response(AppointmentSerializer(appointment).data)
```

`IdempotentCreateMixin.create` envuelve el `create()` propio de esta clase (el MRO hace que `IdempotentCreateMixin.create` llame a `super().create()`, que resuelve al `create()` definido arriba, no al de `CreateModelMixin` — por eso `IdempotentCreateMixin` va primero en la lista de bases).

- [ ] **Step 2: Rutas**

En `backend/apps/integrations/public_urls.py`, agregar:

```python
from apps.integrations.appointment_views import AppointmentPublicViewSet

router.register("appointments", AppointmentPublicViewSet, basename="public-appointment")
```

- [ ] **Step 3: Tests**

`backend/apps/integrations/tests/test_public_appointments.py`:

```python
import pytest

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.integrations.models import ApiKey
from apps.services.models import Employee, Service, ServiceStatus

pytestmark = pytest.mark.django_db


def _client_with_key(organization, scopes):
    from rest_framework.test import APIClient

    _key, plaintext = ApiKey.generate(organization=organization, name="Test", scopes=scopes)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"ApiKey {plaintext}")
    return client


@pytest.fixture
def booking_fixtures(organization):
    branch = Branch.objects.create(organization=organization, name="Sucursal Centro")
    service = Service.objects.create(
        organization=organization, name="Corte", duration_minutes=30, price=10, status=ServiceStatus.ACTIVE
    )
    employee = Employee.objects.create(organization=organization, first_name="Ana", last_name="Ruiz", branch=branch)
    employee.services.add(service)
    customer = Customer.objects.create(organization=organization, first_name="Cliente", last_name="Uno")
    return {"branch": branch, "service": service, "employee": employee, "customer": customer}


def test_create_appointment_via_public_api(organization, booking_fixtures):
    response = _client_with_key(organization, ["appointments:write"]).post(
        "/api/public/v1/appointments/",
        {
            "customer_id": str(booking_fixtures["customer"].id),
            "service_id": str(booking_fixtures["service"].id),
            "employee_id": str(booking_fixtures["employee"].id),
            "branch_id": str(booking_fixtures["branch"].id),
            "appointment_date": "2026-09-01",
            "start_time": "10:00:00",
        },
        format="json",
    )
    assert response.status_code == 201
    appointment = Appointment.objects.get(id=response.data["id"])
    assert appointment.booking_channel == "api"


def test_repeated_create_with_same_idempotency_key_does_not_duplicate(organization, booking_fixtures):
    client = _client_with_key(organization, ["appointments:write"])
    payload = {
        "customer_id": str(booking_fixtures["customer"].id),
        "service_id": str(booking_fixtures["service"].id),
        "employee_id": str(booking_fixtures["employee"].id),
        "branch_id": str(booking_fixtures["branch"].id),
        "appointment_date": "2026-09-02",
        "start_time": "11:00:00",
    }
    headers = {"HTTP_IDEMPOTENCY_KEY": "retry-001"}

    response1 = client.post("/api/public/v1/appointments/", payload, format="json", **headers)
    response2 = client.post("/api/public/v1/appointments/", payload, format="json", **headers)

    assert response1.status_code == response2.status_code == 201
    assert response1.data["id"] == response2.data["id"]
    assert Appointment.objects.filter(appointment_date="2026-09-02").count() == 1


def test_cancel_appointment_via_public_api(organization, booking_fixtures):
    client = _client_with_key(organization, ["appointments:write"])
    create_response = client.post(
        "/api/public/v1/appointments/",
        {
            "customer_id": str(booking_fixtures["customer"].id),
            "service_id": str(booking_fixtures["service"].id),
            "employee_id": str(booking_fixtures["employee"].id),
            "branch_id": str(booking_fixtures["branch"].id),
            "appointment_date": "2026-09-03",
            "start_time": "09:00:00",
        },
        format="json",
    )
    appointment_id = create_response.data["id"]

    response = client.post(f"/api/public/v1/appointments/{appointment_id}/cancel/", {"reason": "test"}, format="json")
    assert response.status_code == 200
    assert response.data["status"] == AppointmentStatus.CANCELLED


def test_appointments_isolated_between_organizations(organization, other_organization, booking_fixtures):
    Appointment.objects.create(
        organization=other_organization,
        customer=Customer.objects.create(organization=other_organization, first_name="X", last_name="Y"),
        service=Service.objects.create(organization=other_organization, name="S", duration_minutes=30, price=5, status=ServiceStatus.ACTIVE),
        employee=Employee.objects.create(organization=other_organization, first_name="E", last_name="F"),
        branch=Branch.objects.create(organization=other_organization, name="Otra sucursal"),
        appointment_date="2026-09-01",
        start_time="10:00:00",
        end_time="10:30:00",
        duration_minutes=30,
        price=5,
        status=AppointmentStatus.CONFIRMED,
    )
    response = _client_with_key(organization, ["appointments:read"]).get("/api/public/v1/appointments/")
    assert response.data["count"] == 0
```

Run: `cd backend && pytest apps/integrations/tests/test_public_appointments.py -v`
Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/integrations/appointment_views.py backend/apps/integrations/public_urls.py backend/apps/integrations/tests/test_public_appointments.py
git commit -m "feat(integrations): recurso publico de citas con idempotencia y cancelacion"
```

---

## Task 10: Recurso público de pagos (con idempotencia)

**Files:**
- Create: `backend/apps/integrations/payment_views.py`
- Modify: `backend/apps/integrations/public_urls.py`
- Create: `backend/apps/integrations/tests/test_public_payments.py`

**Interfaces:**
- Consumes: `apps.payments.serializers.{PaymentSerializer,CreatePaymentSerializer}`, `apps.payments.services.{CreatePaymentRequest,CreatePaymentUseCase}`, `apps.payments.models.Payment`, `apps.integrations.idempotency.IdempotentCreateMixin`.
- Produces: `PaymentPublicViewSet` bajo `/api/public/v1/payments/`.

- [ ] **Step 1: Vista**

`backend/apps/integrations/payment_views.py`:

```python
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response

from apps.integrations.idempotency import IdempotentCreateMixin
from apps.integrations.permissions import HasScope
from apps.integrations.views_base import PublicApiBaseViewSet
from apps.payments.models import Payment
from apps.payments.serializers import CreatePaymentSerializer, PaymentSerializer
from apps.payments.services import CreatePaymentRequest, CreatePaymentUseCase


class PaymentPublicViewSet(
    IdempotentCreateMixin, CreateModelMixin, RetrieveModelMixin, ListModelMixin, PublicApiBaseViewSet
):
    serializer_class = PaymentSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "customer": ["exact"], "method": ["exact"]}
    ordering_fields = ["created_at", "amount"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action == "create":
            return [HasScope("payments:write")]
        return [HasScope("payments:read")]

    def get_queryset(self):
        return Payment.objects.select_related("customer", "appointment").all()

    def create(self, request, *args, **kwargs):
        payload = CreatePaymentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CreatePaymentUseCase(organization=request.user.organization, actor_user=None)
        payment = use_case.execute(
            CreatePaymentRequest(
                customer_id=str(data["customer_id"]),
                appointment_id=str(data["appointment_id"]) if data.get("appointment_id") else None,
                amount=data["amount"],
                method=data["method"],
                notes=data.get("notes", ""),
            )
        )
        return Response(PaymentSerializer(payment).data, status=201)
```

(verificar la firma exacta de `CreatePaymentUseCase.__init__` en `apps/payments/services.py` antes de este paso — si no acepta `actor_user`, quitar el argumento; el resto del código de este plan asume que sí, por paralelismo con `apps/payments/views.py::PaymentViewSet.create`, que ya lo usa así).

- [ ] **Step 2: Rutas**

En `backend/apps/integrations/public_urls.py`:

```python
from apps.integrations.payment_views import PaymentPublicViewSet

router.register("payments", PaymentPublicViewSet, basename="public-payment")
```

- [ ] **Step 3: Tests**

`backend/apps/integrations/tests/test_public_payments.py`:

```python
import pytest

from apps.customers.models import Customer
from apps.integrations.models import ApiKey
from apps.payments.models import Payment

pytestmark = pytest.mark.django_db


def _client_with_key(organization, scopes):
    from rest_framework.test import APIClient

    _key, plaintext = ApiKey.generate(organization=organization, name="Test", scopes=scopes)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"ApiKey {plaintext}")
    return client


def test_create_payment_via_public_api(organization):
    customer = Customer.objects.create(organization=organization, first_name="Cliente", last_name="Uno")
    response = _client_with_key(organization, ["payments:write"]).post(
        "/api/public/v1/payments/",
        {"customer_id": str(customer.id), "amount": "25.00", "method": "cash"},
        format="json",
    )
    assert response.status_code == 201
    assert Payment.objects.filter(customer=customer, amount="25.00").exists()


def test_repeated_payment_create_with_idempotency_key_creates_once(organization):
    customer = Customer.objects.create(organization=organization, first_name="Cliente", last_name="Uno")
    client = _client_with_key(organization, ["payments:write"])
    payload = {"customer_id": str(customer.id), "amount": "40.00", "method": "card"}
    headers = {"HTTP_IDEMPOTENCY_KEY": "pay-retry-1"}

    client.post("/api/public/v1/payments/", payload, format="json", **headers)
    client.post("/api/public/v1/payments/", payload, format="json", **headers)

    assert Payment.objects.filter(customer=customer, amount="40.00").count() == 1


def test_create_payment_requires_write_scope(organization):
    customer = Customer.objects.create(organization=organization, first_name="Cliente", last_name="Uno")
    response = _client_with_key(organization, ["payments:read"]).post(
        "/api/public/v1/payments/", {"customer_id": str(customer.id), "amount": "10.00", "method": "cash"}, format="json"
    )
    assert response.status_code == 403
```

Run: `cd backend && pytest apps/integrations/tests/test_public_payments.py -v`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/apps/integrations/payment_views.py backend/apps/integrations/public_urls.py backend/apps/integrations/tests/test_public_payments.py
git commit -m "feat(integrations): recurso publico de pagos con idempotencia"
```

---

## Task 11: `WebhookEndpoint` / `WebhookDelivery` — modelos y CRUD-lite

**Files:**
- Modify: `backend/apps/integrations/models.py`
- Create: `backend/apps/integrations/migrations/0003_webhookendpoint_webhookdelivery.py` (generada)
- Create: `backend/apps/integrations/webhook_serializers.py`
- Create: `backend/apps/integrations/webhook_views.py`
- Modify: `backend/apps/integrations/public_urls.py`
- Create: `backend/apps/integrations/tests/test_webhook_endpoints_api.py`

**Interfaces:**
- Produces: `apps.integrations.models.{WebhookDeliveryStatus,WebhookEndpoint,WebhookDelivery}`, `WEBHOOK_EVENT_CATALOG: list[str]`, `WebhookEndpointViewSet` bajo `/api/public/v1/webhooks/`, acción `deliveries` (`GET /api/public/v1/webhooks/{id}/deliveries/`).

- [ ] **Step 1: Modelos**

Agregar a `backend/apps/integrations/models.py` (al final, junto a `TenantAwareModel` ya importado en la Tarea 7):

```python
WEBHOOK_EVENT_CATALOG: list[str] = [
    "appointment.created",
    "appointment.confirmed",
    "appointment.cancelled",
    "appointment.rescheduled",
    "payment.registered",
    "payment.refunded",
    "order.status_changed",
    "work_order.status_changed",
    "lab_result.validated",
    "case.status_changed",
]


class WebhookDeliveryStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    SUCCESS = "success", "Entregado"
    FAILED = "failed", "Fallido (reintentos agotados)"


class WebhookEndpoint(TenantAwareModel, TimeStampedModel):
    url = models.URLField()
    secret = models.CharField(max_length=64, editable=False)
    events = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"{self.url} ({len(self.events)} eventos)"

    @classmethod
    def create_with_secret(cls, *, organization, url: str, events: list[str]) -> WebhookEndpoint:
        invalid = sorted(set(events) - set(WEBHOOK_EVENT_CATALOG))
        if invalid:
            from core import exceptions as domain_exceptions

            raise domain_exceptions.ValidationError(
                "Uno o más eventos no existen en el catálogo de webhooks.",
                details={"invalid_events": invalid, "valid_events": WEBHOOK_EVENT_CATALOG},
            )
        return cls.objects.create(organization=organization, url=url, events=events, secret=secrets.token_urlsafe(32))


class WebhookDelivery(TenantAwareModel, TimeStampedModel):
    webhook_endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name="deliveries")
    event_type = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=WebhookDeliveryStatus.choices, default=WebhookDeliveryStatus.PENDING)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    response_status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body_snippet = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-created_at"]
```

- [ ] **Step 2: Migración**

Run: `cd backend && python manage.py makemigrations integrations && python manage.py migrate integrations`

- [ ] **Step 3: Serializers**

`backend/apps/integrations/webhook_serializers.py`:

```python
from __future__ import annotations

from rest_framework import serializers

from apps.integrations.models import WebhookDelivery, WebhookEndpoint


class WebhookEndpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEndpoint
        fields = ["id", "url", "events", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class CreateWebhookEndpointSerializer(serializers.Serializer):
    url = serializers.URLField()
    events = serializers.ListField(child=serializers.CharField(), allow_empty=False)


class WebhookDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDelivery
        fields = [
            "id",
            "event_type",
            "status",
            "attempt_count",
            "last_attempt_at",
            "response_status_code",
            "response_body_snippet",
            "created_at",
        ]
        read_only_fields = fields
```

- [ ] **Step 4: Vista**

`backend/apps/integrations/webhook_views.py`:

```python
from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.mixins import CreateModelMixin, DestroyModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response

from apps.integrations.models import WebhookEndpoint
from apps.integrations.permissions import HasScope
from apps.integrations.views_base import PublicApiBaseViewSet
from apps.integrations.webhook_serializers import (
    CreateWebhookEndpointSerializer,
    WebhookDeliverySerializer,
    WebhookEndpointSerializer,
)


class WebhookEndpointViewSet(
    CreateModelMixin, RetrieveModelMixin, ListModelMixin, DestroyModelMixin, PublicApiBaseViewSet
):
    serializer_class = WebhookEndpointSerializer
    permission_classes = [HasScope("webhooks:manage")]

    def get_queryset(self):
        return WebhookEndpoint.objects.all()

    def create(self, request, *args, **kwargs):
        payload = CreateWebhookEndpointSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        endpoint = WebhookEndpoint.create_with_secret(
            organization=request.user.organization,
            url=payload.validated_data["url"],
            events=payload.validated_data["events"],
        )
        return Response(WebhookEndpointSerializer(endpoint).data, status=201)

    @action(detail=True, methods=["get"])
    def deliveries(self, request, pk=None):
        endpoint = self.get_object()
        page = self.paginate_queryset(endpoint.deliveries.all())
        serializer = WebhookDeliverySerializer(page if page is not None else endpoint.deliveries.all(), many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)
```

- [ ] **Step 5: Rutas**

En `backend/apps/integrations/public_urls.py`:

```python
from apps.integrations.webhook_views import WebhookEndpointViewSet

router.register("webhooks", WebhookEndpointViewSet, basename="public-webhook")
```

- [ ] **Step 6: Tests**

`backend/apps/integrations/tests/test_webhook_endpoints_api.py`:

```python
import pytest

from apps.integrations.models import ApiKey, WebhookEndpoint

pytestmark = pytest.mark.django_db


def _client_with_key(organization, scopes):
    from rest_framework.test import APIClient

    _key, plaintext = ApiKey.generate(organization=organization, name="Test", scopes=scopes)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"ApiKey {plaintext}")
    return client


def test_create_webhook_endpoint(organization):
    response = _client_with_key(organization, ["webhooks:manage"]).post(
        "/api/public/v1/webhooks/",
        {"url": "https://example.com/hook", "events": ["appointment.created"]},
        format="json",
    )
    assert response.status_code == 201
    endpoint = WebhookEndpoint.objects.get(id=response.data["id"])
    assert endpoint.secret  # no se expone en el serializer, pero existe
    assert "secret" not in response.data


def test_create_webhook_endpoint_rejects_unknown_event(organization):
    response = _client_with_key(organization, ["webhooks:manage"]).post(
        "/api/public/v1/webhooks/", {"url": "https://example.com/hook", "events": ["algo.raro"]}, format="json"
    )
    assert response.status_code == 422


def test_delete_webhook_endpoint(organization):
    endpoint = WebhookEndpoint.create_with_secret(organization=organization, url="https://example.com/hook", events=["appointment.created"])
    response = _client_with_key(organization, ["webhooks:manage"]).delete(f"/api/public/v1/webhooks/{endpoint.id}/")
    assert response.status_code == 204
```

Run: `cd backend && pytest apps/integrations/tests/test_webhook_endpoints_api.py -v`
Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/integrations/models.py backend/apps/integrations/migrations backend/apps/integrations/webhook_serializers.py backend/apps/integrations/webhook_views.py backend/apps/integrations/public_urls.py backend/apps/integrations/tests/test_webhook_endpoints_api.py
git commit -m "feat(integrations): CRUD de endpoints de webhook"
```

---

## Task 12: Dispatcher de webhooks (bus de eventos → firma HMAC → entrega con reintentos)

**Files:**
- Modify: `backend/apps/integrations/webhooks.py` (reemplaza el stub de la Tarea 1)
- Create: `backend/apps/integrations/webhook_tasks.py`
- Create: `backend/apps/integrations/tests/test_webhook_dispatch.py`

**Interfaces:**
- Consumes: `core.events.subscribe` (ya existe), `apps.integrations.models.{WebhookEndpoint,WebhookDelivery,WebhookDeliveryStatus,WEBHOOK_EVENT_CATALOG}`.
- Produces: `apps.integrations.webhooks.register_webhook_dispatch()` (ya referenciada desde `apps.py`), `apps.integrations.webhook_tasks.deliver_webhook_task`.

- [ ] **Step 1: Dispatcher — de evento de dominio a `WebhookDelivery` pendiente**

`backend/apps/integrations/webhooks.py`:

```python
from __future__ import annotations

import logging

from core import events
from core.context import get_current_organization_id

logger = logging.getLogger("app")

# Nombre del evento de dominio -> atributo del payload de `**kwargs` que
# identifica la entidad principal, usado solo para armar el payload del
# webhook (no para lógica de negocio).
_EVENT_ENTITY_KWARG = {
    "appointment.created": "appointment",
    "appointment.confirmed": "appointment",
    "appointment.cancelled": "appointment",
    "appointment.rescheduled": "new_appointment",
    "payment.registered": "payment",
    "payment.refunded": "payment",
    "order.status_changed": "order",
    "work_order.status_changed": "work_order",
    "lab_result.validated": "lab_result",
    "case.status_changed": "legal_case",
}


def _handle_domain_event(event_name: str, **payload) -> None:
    from apps.integrations.models import WebhookDeliveryStatus, WebhookEndpoint

    organization_id = get_current_organization_id()
    if organization_id is None:
        return

    entity_kwarg = _EVENT_ENTITY_KWARG.get(event_name)
    entity = payload.get(entity_kwarg) if entity_kwarg else None
    entity_payload = {"id": str(entity.id)} if entity is not None and hasattr(entity, "id") else {}

    endpoints = WebhookEndpoint.objects.filter(is_active=True, events__contains=[event_name])
    for endpoint in endpoints:
        from apps.integrations.models import WebhookDelivery
        from apps.integrations.webhook_tasks import deliver_webhook_task

        delivery = WebhookDelivery.objects.create(
            organization_id=organization_id,
            webhook_endpoint=endpoint,
            event_type=event_name,
            payload={"event": event_name, "data": entity_payload},
            status=WebhookDeliveryStatus.PENDING,
        )
        deliver_webhook_task.delay(str(delivery.id))


def register_webhook_dispatch() -> None:
    from apps.integrations.models import WEBHOOK_EVENT_CATALOG

    for event_name in WEBHOOK_EVENT_CATALOG:
        events.subscribe(event_name, lambda event_name=event_name, **payload: _handle_domain_event(event_name, **payload))
```

Nota: `events.emit` (`core/events.py`) ya atrapa y loguea cualquier excepción del handler sin romper el flujo principal — no hace falta try/except adicional aquí.

- [ ] **Step 2: Tarea Celery de entrega con firma y reintentos**

`backend/apps/integrations/webhook_tasks.py`:

```python
from __future__ import annotations

import hashlib
import hmac
import json
import logging

import requests
from celery import shared_task
from django.utils import timezone

from apps.integrations.models import WebhookDelivery, WebhookDeliveryStatus
from core.context import tenant_scope

logger = logging.getLogger("app")

RETRY_BACKOFF_SECONDS = [60, 300, 1800, 7200, 43200]  # 1m, 5m, 30m, 2h, 12h
DELIVERY_TIMEOUT_SECONDS = 10


def _sign(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@shared_task(bind=True, max_retries=len(RETRY_BACKOFF_SECONDS))
def deliver_webhook_task(self, delivery_id: str) -> None:
    delivery = WebhookDelivery.all_objects.select_related("webhook_endpoint").filter(id=delivery_id).first()
    if delivery is None:
        return

    with tenant_scope(delivery.organization_id):
        _attempt_delivery(self, delivery)


def _attempt_delivery(task, delivery: WebhookDelivery) -> None:
    body = json.dumps(delivery.payload).encode()
    signature = _sign(body, delivery.webhook_endpoint.secret)
    delivery.attempt_count += 1
    delivery.last_attempt_at = timezone.now()

    try:
        response = requests.post(
            delivery.webhook_endpoint.url,
            data=body,
            headers={"Content-Type": "application/json", "X-Signature": signature},
            timeout=DELIVERY_TIMEOUT_SECONDS,
        )
        delivery.response_status_code = response.status_code
        delivery.response_body_snippet = response.text[:500]
        if 200 <= response.status_code < 300:
            delivery.status = WebhookDeliveryStatus.SUCCESS
            delivery.save(update_fields=["attempt_count", "last_attempt_at", "response_status_code", "response_body_snippet", "status"])
            return
        raise requests.RequestException(f"HTTP {response.status_code}")
    except requests.RequestException as exc:
        delivery.save(update_fields=["attempt_count", "last_attempt_at", "response_status_code", "response_body_snippet"])
        _retry_or_fail(task, delivery, exc)


def _retry_or_fail(task, delivery: WebhookDelivery, exc: Exception) -> None:
    attempt_index = delivery.attempt_count - 1
    if attempt_index < len(RETRY_BACKOFF_SECONDS):
        countdown = RETRY_BACKOFF_SECONDS[attempt_index]
        logger.warning(
            "Reintento de entrega de webhook programado",
            extra={"event": "webhook.delivery_retry", "severity": "warning", "data": {"delivery_id": str(delivery.id), "countdown": countdown}},
        )
        raise task.retry(exc=exc, countdown=countdown)
    delivery.status = WebhookDeliveryStatus.FAILED
    delivery.save(update_fields=["status"])
    logger.warning(
        "Entrega de webhook agotó reintentos",
        extra={"event": "webhook.delivery_failed", "severity": "warning", "data": {"delivery_id": str(delivery.id)}},
    )
```

- [ ] **Step 3: Tests**

`backend/apps/integrations/tests/test_webhook_dispatch.py`:

```python
import hashlib
import hmac
import json
from unittest.mock import patch

import pytest

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.integrations.models import WebhookDelivery, WebhookDeliveryStatus, WebhookEndpoint
from apps.services.models import Employee, Service, ServiceStatus
from core import events
from core.context import tenant_scope

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _ensure_dispatcher_registered():
    from apps.integrations.webhooks import register_webhook_dispatch

    register_webhook_dispatch()


def test_appointment_created_event_creates_pending_delivery(organization):
    endpoint = WebhookEndpoint.create_with_secret(organization=organization, url="https://example.com/hook", events=["appointment.created"])
    branch = Branch.objects.create(organization=organization, name="Sucursal")
    service = Service.objects.create(organization=organization, name="S", duration_minutes=30, price=10, status=ServiceStatus.ACTIVE)
    employee = Employee.objects.create(organization=organization, first_name="E", last_name="F")
    customer = Customer.objects.create(organization=organization, first_name="C", last_name="D")

    with tenant_scope(organization.id):
        appointment = Appointment.objects.create(
            organization=organization, branch=branch, service=service, employee=employee, customer=customer,
            appointment_date="2026-09-01", start_time="09:00:00", end_time="09:30:00", duration_minutes=30,
            price=10, status=AppointmentStatus.PENDING,
        )
        with patch("apps.integrations.webhook_tasks.deliver_webhook_task.delay") as mock_delay:
            events.emit("appointment.created", appointment=appointment)

    delivery = WebhookDelivery.objects.get(webhook_endpoint=endpoint)
    assert delivery.event_type == "appointment.created"
    assert delivery.status == WebhookDeliveryStatus.PENDING
    mock_delay.assert_called_once_with(str(delivery.id))


def test_deliver_webhook_task_signs_payload_and_marks_success(organization):
    endpoint = WebhookEndpoint.create_with_secret(organization=organization, url="https://example.com/hook", events=["payment.registered"])
    delivery = WebhookDelivery.objects.create(
        organization=organization, webhook_endpoint=endpoint, event_type="payment.registered", payload={"event": "payment.registered", "data": {"id": "1"}}
    )
    from apps.integrations.webhook_tasks import deliver_webhook_task

    with patch("apps.integrations.webhook_tasks.requests.post") as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.text = "ok"
        deliver_webhook_task.run(str(delivery.id))

    delivery.refresh_from_db()
    assert delivery.status == WebhookDeliveryStatus.SUCCESS
    sent_body = mock_post.call_args.kwargs["data"]
    sent_signature = mock_post.call_args.kwargs["headers"]["X-Signature"]
    expected_signature = hmac.new(endpoint.secret.encode(), sent_body, hashlib.sha256).hexdigest()
    assert sent_signature == expected_signature


def test_deliver_webhook_task_retries_on_failure(organization):
    endpoint = WebhookEndpoint.create_with_secret(organization=organization, url="https://example.com/hook", events=["payment.registered"])
    delivery = WebhookDelivery.objects.create(organization=organization, webhook_endpoint=endpoint, event_type="payment.registered", payload={})
    from apps.integrations.webhook_tasks import deliver_webhook_task

    with patch("apps.integrations.webhook_tasks.requests.post") as mock_post, patch.object(
        deliver_webhook_task, "retry", side_effect=Exception("retried")
    ) as mock_retry:
        mock_post.return_value.status_code = 500
        mock_post.return_value.text = "error"
        with pytest.raises(Exception, match="retried"):
            deliver_webhook_task.run(str(delivery.id))

    mock_retry.assert_called_once()
    delivery.refresh_from_db()
    assert delivery.attempt_count == 1
    assert delivery.status == WebhookDeliveryStatus.PENDING


def test_deliver_webhook_task_marks_failed_after_max_retries(organization):
    endpoint = WebhookEndpoint.create_with_secret(organization=organization, url="https://example.com/hook", events=["payment.registered"])
    delivery = WebhookDelivery.objects.create(
        organization=organization, webhook_endpoint=endpoint, event_type="payment.registered", payload={}, attempt_count=5
    )
    from apps.integrations.webhook_tasks import deliver_webhook_task

    with patch("apps.integrations.webhook_tasks.requests.post") as mock_post:
        mock_post.return_value.status_code = 500
        mock_post.return_value.text = "error"
        deliver_webhook_task.run(str(delivery.id))

    delivery.refresh_from_db()
    assert delivery.status == WebhookDeliveryStatus.FAILED
```

Run: `cd backend && pytest apps/integrations/tests/test_webhook_dispatch.py -v`
Expected: 4 passed.

(Nota: `attempt_count=5` en el último test asume `len(RETRY_BACKOFF_SECONDS) == 5`; si se ajusta la lista de backoff, ajustar también el test).

- [ ] **Step 4: Commit**

```bash
git add backend/apps/integrations/webhooks.py backend/apps/integrations/webhook_tasks.py backend/apps/integrations/tests/test_webhook_dispatch.py
git commit -m "feat(integrations): dispatcher de webhooks con firma HMAC y reintentos con backoff"
```

---

## Task 13: Eventos de dominio faltantes (`order.status_changed`, `work_order.status_changed`, `case.status_changed`)

**Files:**
- Modify: `backend/apps/modules/store/services.py`
- Modify: `backend/apps/modules/moto/services.py`
- Modify: `backend/apps/modules/legal/services.py`
- Modify: `backend/apps/modules/store/tests/test_services.py` (o el archivo equivalente donde ya se testean transiciones)
- Modify: `backend/apps/modules/moto/tests/test_services.py`
- Modify: `backend/apps/modules/legal/tests/test_services.py`

**Interfaces:**
- Consumes: `core.events.emit` (ya usado en los tres módulos).
- Produces: nada nuevo exportado — solo agrega emisiones de eventos que el dispatcher de la Tarea 12 ya sabe escuchar.

- [ ] **Step 1: Tienda — agregar emisión junto a la granular existente**

En `backend/apps/modules/store/services.py`, ubicar la línea `events.emit(f"order.{new_status}", order=order)` (dentro de `TransitionOrderUseCase`) y agregar inmediatamente después:

```python
        events.emit(f"order.{new_status}", order=order)
        events.emit("order.status_changed", order=order, previous_status=previous_status, new_status=new_status)
```

(usar el nombre real de la variable de estado previo tal como esté en ese método — revisar el código actual antes de editar; si no existe una variable `previous_status` en ese punto, capturarla al inicio del método igual que hace `TransitionAppointmentUseCase._transition` en `apps/appointments/services.py`).

- [ ] **Step 2: Taller de motos — mismo patrón**

En `backend/apps/modules/moto/services.py`, junto a `events.emit(f"work_order.{new_status}", work_order=work_order)`:

```python
        events.emit(f"work_order.{new_status}", work_order=work_order)
        events.emit("work_order.status_changed", work_order=work_order, previous_status=previous_status, new_status=new_status)
```

- [ ] **Step 3: Legal — agregar la primera emisión de eventos del módulo**

En `backend/apps/modules/legal/services.py`, dentro de `TransitionLegalCaseUseCase._execute`, después de `legal_case.save(update_fields=update_fields)` y antes de `CaseEvent.objects.create(...)`, agregar el import al inicio del archivo (`from core import events`) y la emisión:

```python
        events.emit("case.status_changed", legal_case=legal_case, previous_status=previous_status, new_status=new_status)
```

- [ ] **Step 4: Tests — un caso por módulo, verificando que el bus recibe el evento**

Agregar a los archivos de test existentes de cada módulo (no crear archivos nuevos: seguir el patrón ya usado por `apps/appointments/tests/test_services.py` si emite eventos ahí, o agregar un test dedicado mínimo por módulo):

```python
# apps/modules/store/tests/test_services.py (agregar al final)
from unittest.mock import patch


def test_transition_order_emits_status_changed_event(organization, ...):  # usar los fixtures ya definidos en ese archivo
    ...  # crear la orden y transicionarla como ya hacen los tests existentes de este archivo
    with patch("apps.modules.store.services.events.emit") as mock_emit:
        # ejecutar la transición existente
        ...
    calls = [call.args[0] for call in mock_emit.call_args_list]
    assert "order.status_changed" in calls
```

(Adaptar el cuerpo del test a los fixtures/factories ya presentes en cada `test_services.py` de `apps/modules/{store,moto,legal}/tests/` — no reinventar el setup de orden/work_order/caso, reutilizar el ya existente en esos archivos. Repetir el mismo patrón de aserción para `work_order.status_changed` en `apps/modules/moto/tests/test_services.py` y `case.status_changed` en `apps/modules/legal/tests/test_services.py`.)

Run: `cd backend && pytest apps/modules/store apps/modules/moto apps/modules/legal -v`
Expected: todos los tests existentes siguen en verde + los 3 nuevos.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/modules/store/services.py backend/apps/modules/moto/services.py backend/apps/modules/legal/services.py backend/apps/modules/store/tests backend/apps/modules/moto/tests backend/apps/modules/legal/tests
git commit -m "feat(modules): emitir eventos de cambio de estado agregados para el catalogo de webhooks"
```

---

## Task 14: `drf-spectacular` tags, seed/sandbox, docs y verificación final

**Files:**
- Modify: `backend/apps/integrations/{oauth_views,resource_views,appointment_views,payment_views,webhook_views,admin_views}.py` (agregar `@extend_schema(tags=[...])`)
- Modify: `backend/apps/organizations/management/commands/seed_demo.py`
- Modify: `docs/erd.md`
- Modify: `docs/security-iso27001.md`
- Modify: `docs/quality-iso25010.md`
- Modify: `docs/test-plan.md`
- Modify: `docs/checklist.md`
- Create: `docs/public-api-examples.md`

**Interfaces:**
- Consumes: todo lo construido en las Tareas 1–13.
- Produces: nada nuevo consumido por otro código — cierre de la fase.

- [ ] **Step 1: Tags de OpenAPI**

En cada viewset/vista pública (`oauth_views.py`, `resource_views.py`, `appointment_views.py`, `payment_views.py`, `webhook_views.py`), agregar el decorador de clase de `drf-spectacular` para agruparlas bajo un tag común en `/api/docs/`:

```python
from drf_spectacular.utils import extend_schema_view, extend_schema

@extend_schema_view(
    list=extend_schema(tags=["public-api"]),
    create=extend_schema(tags=["public-api"]),
    retrieve=extend_schema(tags=["public-api"]),
    update=extend_schema(tags=["public-api"]),
    partial_update=extend_schema(tags=["public-api"]),
    destroy=extend_schema(tags=["public-api"]),
)
class <ViewSetClassName>(...):
    ...
```

(aplicar solo los métodos que cada viewset realmente implementa; para `TokenView`/`AvailabilityPublicView`, que son `APIView`/`GenericAPIView` simples, usar `@extend_schema(tags=["public-api"])` directamente sobre el método `post`/`get`).

Run: `cd backend && python manage.py spectacular --file /tmp/schema.yaml`
Expected: genera el schema sin errores; verificar visualmente (`grep "public-api" /tmp/schema.yaml`) que los endpoints públicos aparecen agrupados.

- [ ] **Step 2: Sandbox en `seed_demo`**

En `backend/apps/organizations/management/commands/seed_demo.py`, en el método `handle` (donde se crean las demás organizaciones demo), agregar al final:

```python
        from apps.integrations.models import ApiKey

        sandbox_org, _ = Organization.objects.get_or_create(
            name="Sandbox API Pública", defaults={"status": OrganizationStatus.ACTIVE}
        )
        sandbox_key, sandbox_secret = ApiKey.generate(
            organization=sandbox_org,
            name="Sandbox demo key",
            scopes=["customers:read", "customers:write", "services:read", "availability:read", "appointments:read", "appointments:write", "payments:read", "payments:write", "webhooks:manage"],
        )
        self.stdout.write(self.style.SUCCESS(f"API Key sandbox: {sandbox_secret} (organización: {sandbox_org.name})"))
```

(ajustar los imports/estilo exacto al patrón ya usado en ese archivo para crear otras organizaciones demo — revisar el comando completo antes de editar).

Run: `cd backend && python manage.py seed_demo`
Expected: corre sin error e imprime la API key del sandbox en stdout.

- [ ] **Step 3: Actualizar `docs/erd.md`**

Agregar una sección nueva `## API pública de integración` con las 5 entidades nuevas (`ApiKey`, `OAuthClient`, `IdempotencyKey`, `WebhookEndpoint`, `WebhookDelivery`), sus campos principales y relaciones con `Organization`, siguiendo el mismo formato de tabla que las secciones existentes del archivo.

- [ ] **Step 4: Actualizar `docs/security-iso27001.md`**

Agregar una entrada al SoA técnico: control de acceso e identidad de terceros (API Key/OAuth2 hasheados, scopes granulares, revocación), criptografía (HMAC-SHA256 en webhooks, hash PBKDF2 de secretos), registro/monitoreo (logging con `client_id`/`key_id`, `AuditLog` de creación/revocación de credenciales).

- [ ] **Step 5: Actualizar `docs/quality-iso25010.md`**

Agregar nota de eficiencia: rate limiting evita saturación por credencial; la resolución de credencial se cachea una vez por request (Tarea 3) para no duplicar el costo de PBKDF2.

- [ ] **Step 6: Actualizar `docs/test-plan.md`**

Agregar la API pública a la matriz de niveles/técnicas de prueba: aislamiento entre credenciales (caja negra, partición de equivalencia por organización), tabla de decisión de scopes insuficientes, valores límite de rate limiting, transición de estado de `WebhookDelivery` (pending → success / pending → failed tras N reintentos).

- [ ] **Step 7: Marcar el checklist de Fase 12B**

En `docs/checklist.md`, marcar como `[x]` cada línea de la sección `## Fase 12B` que quedó cubierta por este plan, y anotar explícitamente junto a "Endpoints públicos sobre recursos clave" que los recursos de módulo activo quedaron fuera de este incremento (ver `docs/public-api.md`, sección "Alcance del v1"). Dejar sin marcar únicamente lo que de verdad no se hizo.

- [ ] **Step 8: Ejemplos `curl`**

Crear `docs/public-api-examples.md` con ejemplos reales usando la sandbox key generada en el Step 2 (autenticación por API Key, autenticación OAuth2, crear cliente, consultar disponibilidad, crear cita con `Idempotency-Key`, registrar pago, crear webhook, listar entregas de webhook) — cada ejemplo con el comando `curl` completo y una respuesta de ejemplo abreviada.

- [ ] **Step 9: Verificación final de la fase**

Run: `cd backend && python manage.py check`
Expected: sin errores.

Run: `cd backend && python manage.py makemigrations --check --dry-run`
Expected: sin cambios pendientes.

Run: `cd backend && ruff check . && ruff format --check .`
Expected: sin errores.

Run: `cd backend && pytest apps/integrations apps/modules/store apps/modules/moto apps/modules/legal -v`
Expected: todos en verde.

Run: `cd backend && pytest --cov=apps.integrations --cov-report=term-missing`
Expected: cobertura de `apps.integrations` ≥ 90% (control de acceso/credenciales es componente crítico según `CLAUDE.md`); si algo queda por debajo, agregar el test faltante antes de cerrar la tarea.

(Nota: correr toda la suite completa del backend contra PostgreSQL real — no solo `apps.integrations` — sigue pendiente como deuda transversal ya registrada en `docs/checklist.md` desde la Fase 8, a resolver junto con el resto cuando se levante Docker; no es parte de esta tarea).

- [ ] **Step 10: Commit**

```bash
git add backend/apps/integrations backend/apps/organizations/management/commands/seed_demo.py docs/erd.md docs/security-iso27001.md docs/quality-iso25010.md docs/test-plan.md docs/checklist.md docs/public-api-examples.md
git commit -m "docs(integrations): documentacion, sandbox y cierre de la Fase 12B"
```

---

## Self-Review

**Cobertura del spec:** autenticación (API Key + OAuth2 client-credentials) → Tareas 3–4; scopes granulares → Tareas 5, 6; multitenancy por credencial → Tarea 3 (middleware) + verificado en cada test de aislamiento; paginación/`X-Total-Count` → Tarea 5; idempotencia → Tarea 7, aplicada en 9 y 10; rate limiting + headers → Tarea 5; webhooks firmados con reintentos → Tareas 11–12; formato de error uniforme → reutilizado sin cambios (`core.exception_handler`); documentación OpenAPI + sandbox + ejemplos curl → Tarea 14; observabilidad (`client_id`/`key_id` en logs) → cubierto por `PublicApiPrincipal.credential_label` disponible en cada request, más detalle de wiring a logger queda anotado como parte de la Tarea 14 (no requiere código nuevo: los logs de negocio ya interpolan `request.user`/`organization_id` vía `core/logging.py`, y `credential_label` es la pieza equivalente a `user_id` para este flujo). Recursos de módulo activo → explícitamente diferidos (ver `docs/public-api.md`).

**Consistencia de tipos:** `PublicApiPrincipal.scopes` es `frozenset[str]` en todas las tareas que lo consumen (5, 7, 8, 9, 10, 11); `resolve_public_credential` devuelve `tuple[PublicApiPrincipal, ApiKey | OAuthClient] | None | Exception` de forma consistente en Tareas 3 y su uso en `core/middleware.py`.

**Riesgo a vigilar durante la ejecución:** el Step 4 de la Tarea 10 depende de la firma real de `CreatePaymentUseCase.__init__` (no confirmada carácter por carácter en este plan, solo por paralelismo con `apps/payments/views.py`) — el propio step deja la instrucción de verificarla antes de escribir el código. El Step 5 de la Tarea 7 (idempotencia) deja una nota similar sobre `force_authenticate` con `Request` envuelto — quien ejecute la tarea debe confirmar en verde antes de continuar, ajustando el mecanismo de autenticación del test si hace falta (alternativa: setear `request._user`/`request._auth` directamente sobre el `Request` de DRF, sin pasar por `force_authenticate`, como ya hace el propio test).
