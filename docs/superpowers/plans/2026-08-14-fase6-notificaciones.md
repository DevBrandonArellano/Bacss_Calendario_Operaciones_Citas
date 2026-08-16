# Fase 6 — Notificaciones y recordatorios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `apps/notifications` app end-to-end: DB-backed templates, a provider abstraction (email real, WhatsApp/SMS stubs, internal), a use case that renders and dispatches notifications, wiring to the existing domain event bus for appointment lifecycle events, a Celery-beat reminder task, an internal-notifications API, and a frontend notification bell.

**Architecture:** `NotifyEventUseCase` is the single write path for `Notification` rows — it resolves the applicable `NotificationTemplate` (organization override, else global), renders it, and delegates delivery to a `NotificationProvider` chosen via a small factory (`get_provider`), keeping the use case decoupled from concrete channels (email/SMS/WhatsApp/internal). `apps/notifications/handlers.py` subscribes to the appointment events already emitted by `apps/appointments/services.py` via `core/events.py`; a Celery-beat task independently scans confirmed appointments for reminder windows configured per organization.

**Tech Stack:** Django 5 / DRF, PostgreSQL (JSONB), Celery (static `CELERY_BEAT_SCHEDULE`, no `django-celery-beat`), Django template engine for rendering, pytest + pytest-django, React + TypeScript + Vitest on the frontend.

**Spec:** `docs/superpowers/specs/2026-08-14-fase6-notificaciones-design.md`

## Global Constraints

- Multitenancy is non-negotiable: every business model except `NotificationTemplate` (deliberately global-or-override) inherits `core.models.TenantAwareModel`; the `organization_id` is never taken from client input.
- Provider/handler failures must never propagate and break the caller's flow (`core/events.py`'s existing rule, extended here to `NotifyEventUseCase._dispatch`): catch, mark `failed`, log `error` (RFC 5424 via `logger.getLogger("app")`, `extra={"event": ..., "severity": ..., "data": {...}}`), never raise.
- No PII/sensitive content in log `data` payloads for stub providers — log `notification_id`/`event_code`/channel only, never the rendered body.
- API errors go through the existing global exception handler (`core/exception_handler.py`): raise `core.exceptions.NotFoundError` etc. from services, never build ad hoc `Response` error bodies from views.
- TDD: write the failing test, watch it fail, implement, watch it pass, commit — for every step below.
- Test data setup follows the existing project convention: create `TenantAwareModel` rows via `Model.objects.all_objects.create(...)` in fixtures/tests (the default manager is context-filtered and returns nothing without request-scoped tenant context).
- Coverage target ≥ 80% for this app (`docs/test-plan.md`); this is not one of the ≥ 90% critical components (availability/booking engines, payments, access control), but every branch listed in the design doc's Testing section must have a test.

---

### Task 1: Notification models, migration, and admin

**Files:**
- Create: `backend/apps/notifications/apps.py`
- Create: `backend/apps/notifications/models.py`
- Create: `backend/apps/notifications/admin.py`
- Create: `backend/apps/notifications/management/__init__.py`
- Create: `backend/apps/notifications/management/commands/__init__.py`
- Create: `backend/apps/notifications/tests/__init__.py`
- Create: `backend/apps/notifications/tests/conftest.py`
- Create: `backend/apps/notifications/tests/test_models.py`
- Create: `backend/apps/notifications/migrations/__init__.py`
- Create: `backend/apps/notifications/migrations/0001_initial.py` (generated, not hand-written — see Step 5)
- Modify: `backend/config/settings/base.py` (add `"apps.notifications"` to `INSTALLED_APPS`, after `"apps.appointments"`)

**Interfaces:**
- Produces: `apps.notifications.models.NotificationChannel` (`TextChoices`: `EMAIL`, `SMS`, `WHATSAPP`, `INTERNAL`), `NotificationStatus` (`TextChoices`: `QUEUED`, `SENT`, `FAILED`, `READ`), `NotificationTemplate(organization, event_code, channel, subject_template, body_template, is_active)`, `NotificationSetting(organization, reminder_offsets_hours, enabled_channels)`, `Notification(organization, recipient_user, customer, appointment, channel, event_code, template, status, payload, error_message, sent_at, read_at)`.
- Produces test fixtures (in `apps/notifications/tests/conftest.py`, used by every later task's tests): `branch`, `service`, `employee_user`, `employee`, `customer`, `appointment`.

- [ ] **Step 1: Write the failing model tests**

`backend/apps/notifications/tests/__init__.py` (empty file).

`backend/apps/notifications/tests/conftest.py`:

```python
from datetime import date, time, timedelta

import pytest

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.services.models import Employee, Service
from apps.users.models import User


@pytest.fixture
def branch(organization):
    return Branch.objects.all_objects.create(organization=organization, name="Sucursal Norte")


@pytest.fixture
def service(organization):
    return Service.objects.all_objects.create(
        organization=organization, name="Corte", duration_minutes=30, price="10.00"
    )


@pytest.fixture
def employee_user(organization):
    return User.objects.create_user(
        organization=organization, email="profesional@test.com", password="Password123!"
    )


@pytest.fixture
def employee(organization, branch, service, employee_user):
    emp = Employee.objects.all_objects.create(
        organization=organization,
        branch=branch,
        first_name="Ana",
        last_name="Prof",
        user=employee_user,
    )
    emp.services.add(service)
    return emp


@pytest.fixture
def customer(organization):
    return Customer.objects.all_objects.create(
        organization=organization, first_name="Cliente", last_name="Uno", email="cliente@test.com"
    )


@pytest.fixture
def appointment(organization, branch, service, employee, customer):
    target_date = date.today() + timedelta(days=1)
    return Appointment.objects.all_objects.create(
        organization=organization,
        branch=branch,
        customer=customer,
        service=service,
        employee=employee,
        appointment_date=target_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        duration_minutes=30,
        price="10.00",
        status=AppointmentStatus.CONFIRMED,
    )
```

`backend/apps/notifications/tests/test_models.py`:

```python
import pytest
from django.db import IntegrityError

from apps.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationSetting,
    NotificationStatus,
    NotificationTemplate,
)

pytestmark = pytest.mark.django_db


class TestNotificationTemplate:
    def test_unicidad_por_organizacion_evento_canal(self, organization):
        NotificationTemplate.objects.create(
            organization=organization,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="hola",
        )
        with pytest.raises(IntegrityError):
            NotificationTemplate.objects.create(
                organization=organization,
                event_code="appointment.confirmed",
                channel=NotificationChannel.EMAIL,
                body_template="hola de nuevo",
            )

    def test_plantilla_global_y_de_organizacion_coexisten(self, organization):
        NotificationTemplate.objects.create(
            organization=None,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="global",
        )
        override = NotificationTemplate.objects.create(
            organization=organization,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="override",
        )
        assert override.organization_id == organization.id


class TestNotificationSetting:
    def test_unico_por_organizacion(self, organization):
        NotificationSetting.objects.all_objects.create(
            organization=organization, reminder_offsets_hours=[24]
        )
        with pytest.raises(IntegrityError):
            NotificationSetting.objects.all_objects.create(
                organization=organization, reminder_offsets_hours=[2]
            )


class TestNotification:
    def test_valores_por_defecto(self, organization, customer):
        notification = Notification.objects.all_objects.create(
            organization=organization,
            customer=customer,
            channel=NotificationChannel.EMAIL,
            event_code="appointment.confirmed",
        )
        assert notification.status == NotificationStatus.QUEUED
        assert notification.payload == {}
        assert notification.read_at is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest apps/notifications/tests/test_models.py -v`
Expected: FAIL/ERROR — `apps.notifications.models` has no such attributes (module doesn't exist yet).

- [ ] **Step 3: Implement the models**

`backend/apps/notifications/apps.py`:

```python
from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
    label = "notifications"

    def ready(self) -> None:
        from apps.notifications import handlers  # noqa: F401  registra los handlers de eventos
```

(`apps/notifications/handlers.py` doesn't exist yet — it's created in Task 4. Importing it here now will fail at server/test startup once `INSTALLED_APPS` includes this app. To keep this task green in isolation, create a placeholder `backend/apps/notifications/handlers.py` with just a module docstring for now; Task 4 replaces its contents.)

`backend/apps/notifications/handlers.py` (placeholder, replaced in Task 4):

```python
"""Handlers de eventos de dominio para notificaciones (ver Task 4 del plan)."""
```

`backend/apps/notifications/models.py`:

```python
from __future__ import annotations

import uuid

from django.db import models

from core.models import TenantAwareModel, TimeStampedModel


class NotificationChannel(models.TextChoices):
    EMAIL = "email", "Email"
    SMS = "sms", "SMS"
    WHATSAPP = "whatsapp", "WhatsApp"
    INTERNAL = "internal", "Interna"


class NotificationStatus(models.TextChoices):
    QUEUED = "queued", "En cola"
    SENT = "sent", "Enviada"
    FAILED = "failed", "Fallida"
    READ = "read", "Leída"


class NotificationTemplate(TimeStampedModel):
    """Plantilla de notificación. `organization=None` = plantilla global (fallback)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notification_templates",
        null=True,
        blank=True,
    )
    event_code = models.CharField(max_length=100)
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices)
    subject_template = models.CharField(max_length=255, blank=True)
    body_template = models.TextField()
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "event_code", "channel"],
                name="unique_template_per_org_event_channel",
            )
        ]

    def __str__(self) -> str:
        scope = self.organization.name if self.organization_id else "global"
        return f"{self.event_code} · {self.channel} · {scope}"


class NotificationSetting(TenantAwareModel, TimeStampedModel):
    """Configuración de recordatorios por organización (una por organización)."""

    reminder_offsets_hours = models.JSONField(default=list, blank=True)
    enabled_channels = models.JSONField(default=list, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["organization"], name="unique_notification_setting_per_org")
        ]

    def __str__(self) -> str:
        return f"Config notificaciones · {self.organization_id}"


class Notification(TenantAwareModel, TimeStampedModel):
    recipient_user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, related_name="notifications", null=True, blank=True
    )
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.CASCADE, related_name="notifications", null=True, blank=True
    )
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices)
    event_code = models.CharField(max_length=100)
    template = models.ForeignKey(
        NotificationTemplate,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20, choices=NotificationStatus.choices, default=NotificationStatus.QUEUED
    )
    payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "recipient_user", "status"]),
            models.Index(fields=["organization", "customer"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_code} · {self.channel} · {self.status}"
```

`backend/apps/notifications/admin.py`:

```python
from django.contrib import admin

from apps.notifications.models import Notification, NotificationSetting, NotificationTemplate


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ["event_code", "channel", "organization", "is_active"]
    list_filter = ["channel", "is_active"]
    search_fields = ["event_code"]


@admin.register(NotificationSetting)
class NotificationSettingAdmin(admin.ModelAdmin):
    list_display = ["organization", "reminder_offsets_hours", "enabled_channels"]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = [
        "created_at",
        "organization",
        "event_code",
        "channel",
        "status",
        "recipient_user",
        "customer",
    ]
    list_filter = ["channel", "status"]
    search_fields = ["event_code"]
```

Empty package files:

```
backend/apps/notifications/management/__init__.py       # empty
backend/apps/notifications/management/commands/__init__.py  # empty
backend/apps/notifications/migrations/__init__.py        # empty
```

Add `"apps.notifications"` to `INSTALLED_APPS` in `backend/config/settings/base.py`, right after `"apps.appointments",`.

- [ ] **Step 4: Run tests to verify they still fail (no migration yet)**

Run: `cd backend && python -m pytest apps/notifications/tests/test_models.py -v`
Expected: FAIL — `relation "notifications_notificationtemplate" does not exist` (or Django migration-related error), because the migration hasn't been generated.

- [ ] **Step 5: Generate the migration**

Run: `cd backend && python manage.py makemigrations notifications`
Expected: creates `apps/notifications/migrations/0001_initial.py` with `NotificationTemplate`, `NotificationSetting`, `Notification`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && python -m pytest apps/notifications/tests/test_models.py -v`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/apps/notifications backend/config/settings/base.py
git commit -m "feat(notifications): add NotificationTemplate/Setting/Notification models"
```

---

### Task 2: Provider abstraction

**Files:**
- Create: `backend/apps/notifications/providers/__init__.py`
- Create: `backend/apps/notifications/providers/base.py`
- Create: `backend/apps/notifications/providers/email.py`
- Create: `backend/apps/notifications/providers/stubs.py`
- Create: `backend/apps/notifications/providers/internal.py`
- Create: `backend/apps/notifications/tests/test_providers.py`

**Interfaces:**
- Consumes: `apps.notifications.models.Notification`, `NotificationChannel` (Task 1).
- Produces: `apps.notifications.providers.ProviderResult(success: bool, error_message: str = "")`, `apps.notifications.providers.NotificationProvider` (Protocol, method `send(notification) -> ProviderResult`), `apps.notifications.providers.get_provider(channel: str) -> NotificationProvider`. Used by `NotifyEventUseCase` in Task 3.

- [ ] **Step 1: Write the failing provider tests**

`backend/apps/notifications/tests/test_providers.py`:

```python
import pytest

from apps.notifications.models import Notification, NotificationChannel
from apps.notifications.providers import get_provider

pytestmark = pytest.mark.django_db


class TestEmailProvider:
    def test_falla_si_no_hay_email_de_destinatario(self, organization, customer):
        customer.email = ""
        customer.save(update_fields=["email"])
        notification = Notification.objects.all_objects.create(
            organization=organization,
            customer=customer,
            channel=NotificationChannel.EMAIL,
            event_code="appointment.confirmed",
            payload={"subject": "s", "body": "b"},
        )
        result = get_provider("email").send(notification)
        assert result.success is False
        assert result.error_message

    def test_envia_email_si_hay_destinatario(self, organization, customer, mailoutbox):
        notification = Notification.objects.all_objects.create(
            organization=organization,
            customer=customer,
            channel=NotificationChannel.EMAIL,
            event_code="appointment.confirmed",
            payload={"subject": "Asunto", "body": "Cuerpo"},
        )
        result = get_provider("email").send(notification)
        assert result.success is True
        assert len(mailoutbox) == 1
        assert mailoutbox[0].subject == "Asunto"
        assert mailoutbox[0].to == [customer.email]

    def test_usa_email_del_usuario_si_no_hay_cliente(self, organization, employee_user, mailoutbox):
        notification = Notification.objects.all_objects.create(
            organization=organization,
            recipient_user=employee_user,
            channel=NotificationChannel.EMAIL,
            event_code="appointment.created",
            payload={"subject": "Asunto", "body": "Cuerpo"},
        )
        result = get_provider("email").send(notification)
        assert result.success is True
        assert mailoutbox[0].to == [employee_user.email]


class TestStubProviders:
    @pytest.mark.parametrize("channel", ["whatsapp", "sms"])
    def test_stub_siempre_exitoso(self, organization, customer, channel):
        notification = Notification.objects.all_objects.create(
            organization=organization,
            customer=customer,
            channel=channel,
            event_code="appointment.confirmed",
            payload={},
        )
        result = get_provider(channel).send(notification)
        assert result.success is True


class TestInternalProvider:
    def test_siempre_exitoso(self, organization, employee_user):
        notification = Notification.objects.all_objects.create(
            organization=organization,
            recipient_user=employee_user,
            channel=NotificationChannel.INTERNAL,
            event_code="appointment.created",
            payload={},
        )
        result = get_provider("internal").send(notification)
        assert result.success is True


class TestGetProvider:
    def test_canal_desconocido_lanza_value_error(self):
        with pytest.raises(ValueError):
            get_provider("carrier_pigeon")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest apps/notifications/tests/test_providers.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'apps.notifications.providers'`.

- [ ] **Step 3: Implement the providers**

`backend/apps/notifications/providers/base.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from apps.notifications.models import Notification


@dataclass(frozen=True)
class ProviderResult:
    success: bool
    error_message: str = ""


class NotificationProvider(Protocol):
    def send(self, notification: "Notification") -> ProviderResult: ...
```

`backend/apps/notifications/providers/email.py`:

```python
from __future__ import annotations

from django.conf import settings
from django.core.mail import send_mail

from apps.notifications.providers.base import ProviderResult


class EmailProvider:
    def send(self, notification) -> ProviderResult:
        recipient_email = ""
        if notification.customer_id:
            recipient_email = notification.customer.email
        elif notification.recipient_user_id:
            recipient_email = notification.recipient_user.email

        if not recipient_email:
            return ProviderResult(success=False, error_message="El destinatario no tiene email registrado.")

        send_mail(
            subject=notification.payload.get("subject", ""),
            message=notification.payload.get("body", ""),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        return ProviderResult(success=True)
```

`backend/apps/notifications/providers/stubs.py`:

```python
from __future__ import annotations

import logging

from apps.notifications.providers.base import ProviderResult

logger = logging.getLogger("app")


def _log_stub_send(channel: str, notification) -> None:
    logger.info(
        f"Envío simulado por {channel} (proveedor real pendiente, ver docs/roadmap.md)",
        extra={
            "event": f"notification.{channel}_stub_sent",
            "severity": "info",
            "data": {"notification_id": str(notification.id), "event_code": notification.event_code},
        },
    )


class WhatsAppStubProvider:
    def send(self, notification) -> ProviderResult:
        _log_stub_send("whatsapp", notification)
        return ProviderResult(success=True)


class SMSStubProvider:
    def send(self, notification) -> ProviderResult:
        _log_stub_send("sms", notification)
        return ProviderResult(success=True)
```

`backend/apps/notifications/providers/internal.py`:

```python
from __future__ import annotations

from apps.notifications.providers.base import ProviderResult


class InternalProvider:
    def send(self, notification) -> ProviderResult:
        return ProviderResult(success=True)
```

`backend/apps/notifications/providers/__init__.py`:

```python
from __future__ import annotations

from apps.notifications.providers.base import NotificationProvider, ProviderResult
from apps.notifications.providers.email import EmailProvider
from apps.notifications.providers.internal import InternalProvider
from apps.notifications.providers.stubs import SMSStubProvider, WhatsAppStubProvider

_PROVIDERS: dict[str, NotificationProvider] = {
    "email": EmailProvider(),
    "sms": SMSStubProvider(),
    "whatsapp": WhatsAppStubProvider(),
    "internal": InternalProvider(),
}


def get_provider(channel: str) -> NotificationProvider:
    provider = _PROVIDERS.get(channel)
    if provider is None:
        raise ValueError(f"No hay proveedor registrado para el canal '{channel}'.")
    return provider


__all__ = ["NotificationProvider", "ProviderResult", "get_provider"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest apps/notifications/tests/test_providers.py -v`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/apps/notifications/providers backend/apps/notifications/tests/test_providers.py
git commit -m "feat(notifications): add provider abstraction (email, whatsapp/sms stubs, internal)"
```

---

### Task 3: `NotifyEventUseCase` and `MarkNotificationReadUseCase`

**Files:**
- Create: `backend/apps/notifications/services.py`
- Create: `backend/apps/notifications/tests/test_services.py`

**Interfaces:**
- Consumes: `apps.notifications.models.{Notification, NotificationChannel, NotificationStatus, NotificationTemplate}` (Task 1), `apps.notifications.providers.get_provider` (Task 2), `core.exceptions.NotFoundError`.
- Produces: `apps.notifications.services.NotifyEventUseCase().notify(*, event_code: str, organization, context: dict, recipient_user=None, customer=None, appointment=None, channels: list[str] | None = None) -> list[Notification]`; `apps.notifications.services.MarkNotificationReadUseCase().mark_read(*, notification_id: str, user) -> Notification`. Used by Task 4 (handlers) and Task 5 (reminder task) for `NotifyEventUseCase`; used by Task 6 (API view) for `MarkNotificationReadUseCase`.

- [ ] **Step 1: Write the failing service tests**

`backend/apps/notifications/tests/test_services.py`:

```python
import pytest

from apps.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationStatus,
    NotificationTemplate,
)
from apps.notifications.services import MarkNotificationReadUseCase, NotifyEventUseCase
from core import exceptions as domain_exceptions
from core.context import set_current_organization_id

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _tenant_context(organization):
    set_current_organization_id(str(organization.id))
    yield
    set_current_organization_id(None)


class TestNotifyEventUseCase:
    def test_no_crea_notificacion_sin_plantilla(self, organization, customer):
        result = NotifyEventUseCase().notify(
            event_code="appointment.confirmed",
            organization=organization,
            context={},
            customer=customer,
            channels=["email"],
        )
        assert result == []
        assert Notification.objects.all_objects.count() == 0

    def test_usa_override_de_organizacion_sobre_global(self, organization, customer):
        NotificationTemplate.objects.create(
            organization=None,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            subject_template="Global",
            body_template="Hola {{ customer_name }} (global)",
        )
        NotificationTemplate.objects.create(
            organization=organization,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            subject_template="Override",
            body_template="Hola {{ customer_name }} (override)",
        )
        notifications = NotifyEventUseCase().notify(
            event_code="appointment.confirmed",
            organization=organization,
            context={"customer_name": "Ana"},
            customer=customer,
            channels=["email"],
        )
        assert len(notifications) == 1
        assert notifications[0].payload["body"] == "Hola Ana (override)"

    def test_provider_exitoso_marca_sent(self, organization, customer):
        NotificationTemplate.objects.create(
            organization=None,
            event_code="appointment.confirmed",
            channel=NotificationChannel.INTERNAL,
            body_template="Hola {{ customer_name }}",
        )
        notifications = NotifyEventUseCase().notify(
            event_code="appointment.confirmed",
            organization=organization,
            context={"customer_name": "Ana"},
            customer=customer,
            channels=["internal"],
        )
        assert notifications[0].status == NotificationStatus.SENT
        assert notifications[0].sent_at is not None

    def test_provider_fallido_marca_failed_sin_propagar(self, organization):
        NotificationTemplate.objects.create(
            organization=None,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="Hola",
        )
        notifications = NotifyEventUseCase().notify(
            event_code="appointment.confirmed",
            organization=organization,
            context={},
            customer=None,
            channels=["email"],
        )
        assert notifications[0].status == NotificationStatus.FAILED
        assert notifications[0].error_message

    def test_respeta_lista_de_canales_pedida(self, organization, customer):
        NotificationTemplate.objects.create(
            organization=None,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="Hola",
        )
        NotificationTemplate.objects.create(
            organization=None,
            event_code="appointment.confirmed",
            channel=NotificationChannel.INTERNAL,
            body_template="Hola interno",
        )
        notifications = NotifyEventUseCase().notify(
            event_code="appointment.confirmed",
            organization=organization,
            context={},
            customer=customer,
            channels=["internal"],
        )
        assert len(notifications) == 1
        assert notifications[0].channel == NotificationChannel.INTERNAL


class TestMarkNotificationReadUseCase:
    def test_marca_como_leida(self, organization, make_user):
        user = make_user(organization, "staff@test.com")
        notification = Notification.objects.all_objects.create(
            organization=organization,
            recipient_user=user,
            channel=NotificationChannel.INTERNAL,
            event_code="appointment.created",
            status=NotificationStatus.SENT,
        )
        result = MarkNotificationReadUseCase().mark_read(notification_id=str(notification.id), user=user)
        assert result.status == NotificationStatus.READ
        assert result.read_at is not None

    def test_no_encontrada_si_pertenece_a_otro_usuario(self, organization, make_user):
        owner = make_user(organization, "owner@test.com")
        other = make_user(organization, "other@test.com")
        notification = Notification.objects.all_objects.create(
            organization=organization,
            recipient_user=owner,
            channel=NotificationChannel.INTERNAL,
            event_code="appointment.created",
            status=NotificationStatus.SENT,
        )
        with pytest.raises(domain_exceptions.NotFoundError):
            MarkNotificationReadUseCase().mark_read(notification_id=str(notification.id), user=other)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest apps/notifications/tests/test_services.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'apps.notifications.services'`.

- [ ] **Step 3: Implement the services**

`backend/apps/notifications/services.py`:

```python
from __future__ import annotations

import logging

from django.template import Context, Template
from django.utils import timezone

from apps.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationStatus,
    NotificationTemplate,
)
from apps.notifications.providers import get_provider
from core import exceptions as domain_exceptions

logger = logging.getLogger("app")


def _resolve_template(*, organization, event_code: str, channel: str) -> NotificationTemplate | None:
    template = NotificationTemplate.objects.filter(
        organization=organization, event_code=event_code, channel=channel, is_active=True
    ).first()
    if template is not None:
        return template
    return NotificationTemplate.objects.filter(
        organization=None, event_code=event_code, channel=channel, is_active=True
    ).first()


def _channels_for_event(*, organization, event_code: str, requested_channels: list[str] | None) -> list[str]:
    candidates = requested_channels if requested_channels is not None else list(NotificationChannel.values)
    return [
        channel
        for channel in candidates
        if _resolve_template(organization=organization, event_code=event_code, channel=channel) is not None
    ]


class NotifyEventUseCase:
    """Único punto de creación y despacho de `Notification` (docs/superpowers/specs/2026-08-14-fase6-notificaciones-design.md)."""

    def notify(
        self,
        *,
        event_code: str,
        organization,
        context: dict,
        recipient_user=None,
        customer=None,
        appointment=None,
        channels: list[str] | None = None,
    ) -> list[Notification]:
        created: list[Notification] = []
        for channel in _channels_for_event(
            organization=organization, event_code=event_code, requested_channels=channels
        ):
            template = _resolve_template(organization=organization, event_code=event_code, channel=channel)
            rendered_subject = Template(template.subject_template).render(Context(context))
            rendered_body = Template(template.body_template).render(Context(context))

            notification = Notification.objects.create(
                organization=organization,
                recipient_user=recipient_user,
                customer=customer,
                appointment=appointment,
                channel=channel,
                event_code=event_code,
                template=template,
                status=NotificationStatus.QUEUED,
                payload={**context, "subject": rendered_subject, "body": rendered_body},
            )
            self._dispatch(notification)
            created.append(notification)
        return created

    def _dispatch(self, notification: Notification) -> None:
        provider = get_provider(notification.channel)
        try:
            result = provider.send(notification)
        except Exception as exc:  # el proveedor nunca debe romper el flujo que notifica
            logger.error(
                "Fallo inesperado enviando notificación",
                exc_info=True,
                extra={
                    "event": "notification.provider_error",
                    "severity": "error",
                    "data": {"notification_id": str(notification.id), "channel": notification.channel},
                },
            )
            notification.status = NotificationStatus.FAILED
            notification.error_message = str(exc)
            notification.save(update_fields=["status", "error_message", "updated_at"])
            return

        if result.success:
            notification.status = NotificationStatus.SENT
            notification.sent_at = timezone.now()
            notification.save(update_fields=["status", "sent_at", "updated_at"])
        else:
            notification.status = NotificationStatus.FAILED
            notification.error_message = result.error_message
            notification.save(update_fields=["status", "error_message", "updated_at"])
            logger.warning(
                "Notificación no pudo enviarse",
                extra={
                    "event": "notification.send_failed",
                    "severity": "warning",
                    "data": {"notification_id": str(notification.id), "channel": notification.channel},
                },
            )


class MarkNotificationReadUseCase:
    def mark_read(self, *, notification_id: str, user) -> Notification:
        notification = Notification.objects.filter(id=notification_id, recipient_user=user).first()
        if notification is None:
            raise domain_exceptions.NotFoundError("La notificación indicada no existe.")
        if notification.status != NotificationStatus.READ:
            notification.status = NotificationStatus.READ
            notification.read_at = timezone.now()
            notification.save(update_fields=["status", "read_at", "updated_at"])
        return notification
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest apps/notifications/tests/test_services.py -v`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/apps/notifications/services.py backend/apps/notifications/tests/test_services.py
git commit -m "feat(notifications): add NotifyEventUseCase and MarkNotificationReadUseCase"
```

---

### Task 4: Event handlers (wire to `core/events.py`)

**Files:**
- Modify: `backend/apps/notifications/handlers.py` (replace Task 1's placeholder)
- Create: `backend/apps/notifications/tests/test_handlers.py`

**Interfaces:**
- Consumes: `core.events.on`, `core.events.subscribe` (existing, unchanged), `apps.notifications.services.NotifyEventUseCase` (Task 3), the appointment events already emitted by `apps/appointments/services.py`: `appointment.created`, `appointment.confirmed`, `appointment.waiting`, `appointment.in_progress`, `appointment.completed`, `appointment.cancelled`, `appointment.no_show`, `appointment.rescheduled`.
- Produces: nothing new consumed by later tasks — this task's effect is side-effecting event subscriptions, verified through `Notification` rows created by the flows under test.

- [ ] **Step 1: Write the failing handler tests**

`backend/apps/notifications/tests/test_handlers.py`:

```python
import pytest

from apps.appointments.models import AppointmentStatus
from apps.appointments.services import TransitionAppointmentUseCase
from apps.notifications.models import Notification, NotificationChannel, NotificationTemplate
from core.context import set_current_organization_id

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _templates(organization):
    for event_code, channel in [
        ("appointment.confirmed", NotificationChannel.EMAIL),
        ("appointment.cancelled", NotificationChannel.EMAIL),
        ("appointment.created", NotificationChannel.INTERNAL),
        ("appointment.waiting", NotificationChannel.INTERNAL),
        ("appointment.rescheduled", NotificationChannel.INTERNAL),
    ]:
        NotificationTemplate.objects.create(
            organization=None, event_code=event_code, channel=channel, body_template="Hola {{ customer_name }}"
        )


@pytest.fixture(autouse=True)
def _tenant_context(organization):
    set_current_organization_id(str(organization.id))
    yield
    set_current_organization_id(None)


class TestHandlersDeCitas:
    def test_confirmada_notifica_email_al_cliente(self, appointment):
        appointment.status = AppointmentStatus.PENDING
        appointment.save(update_fields=["status", "updated_at"])

        TransitionAppointmentUseCase().transition(appointment, AppointmentStatus.CONFIRMED)

        notifications = Notification.objects.all_objects.filter(
            appointment=appointment, event_code="appointment.confirmed"
        )
        assert notifications.count() == 1
        assert notifications.first().channel == NotificationChannel.EMAIL
        assert notifications.first().customer_id == appointment.customer_id

    def test_cancelada_notifica_email_al_cliente(self, appointment):
        TransitionAppointmentUseCase().transition(appointment, AppointmentStatus.CANCELLED)

        notifications = Notification.objects.all_objects.filter(
            appointment=appointment, event_code="appointment.cancelled"
        )
        assert notifications.count() == 1
        assert notifications.first().channel == NotificationChannel.EMAIL

    def test_otra_transicion_solo_notifica_internamente_al_profesional(self, appointment):
        TransitionAppointmentUseCase().transition(appointment, AppointmentStatus.WAITING)

        notifications = Notification.objects.all_objects.filter(
            appointment=appointment, event_code="appointment.waiting"
        )
        assert notifications.count() == 1
        assert notifications.first().channel == NotificationChannel.INTERNAL
        assert notifications.first().recipient_user_id == appointment.employee.user_id

    def test_sin_usuario_de_acceso_el_profesional_no_recibe_notificacion(self, appointment):
        appointment.employee.user = None
        appointment.employee.save(update_fields=["user", "updated_at"])

        TransitionAppointmentUseCase().transition(appointment, AppointmentStatus.WAITING)

        assert not Notification.objects.all_objects.filter(
            appointment=appointment, event_code="appointment.waiting"
        ).exists()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest apps/notifications/tests/test_handlers.py -v`
Expected: FAIL — no notifications are created because `handlers.py` is still the empty placeholder from Task 1.

- [ ] **Step 3: Implement the handlers**

`backend/apps/notifications/handlers.py`:

```python
"""Handlers de eventos de dominio para notificaciones.

Se registran importando este módulo desde `NotificationsConfig.ready()`
(`apps/notifications/apps.py`). Ver docs/superpowers/specs/2026-08-14-fase6-notificaciones-design.md.
"""

from __future__ import annotations

from apps.notifications.services import NotifyEventUseCase
from core import events

_INTERNAL_ONLY_EVENTS = [
    "appointment.created",
    "appointment.waiting",
    "appointment.in_progress",
    "appointment.completed",
    "appointment.no_show",
]


def _appointment_context(appointment) -> dict:
    return {
        "customer_name": f"{appointment.customer.first_name} {appointment.customer.last_name}",
        "service_name": appointment.service.name,
        "employee_name": f"{appointment.employee.first_name} {appointment.employee.last_name}",
        "branch_name": appointment.branch.name,
        "appointment_date": appointment.appointment_date.isoformat(),
        "start_time": appointment.start_time.strftime("%H:%M"),
    }


def _notify_customer(appointment, event_code: str) -> None:
    NotifyEventUseCase().notify(
        event_code=event_code,
        organization=appointment.organization,
        context=_appointment_context(appointment),
        customer=appointment.customer,
        appointment=appointment,
        channels=["email"],
    )


def _notify_employee_internal(appointment, event_code: str) -> None:
    if appointment.employee.user_id is None:
        return
    NotifyEventUseCase().notify(
        event_code=event_code,
        organization=appointment.organization,
        context=_appointment_context(appointment),
        recipient_user=appointment.employee.user,
        appointment=appointment,
        channels=["internal"],
    )


def _make_internal_handler(event_code: str):
    def handler(appointment, **_kwargs) -> None:
        _notify_employee_internal(appointment, event_code)

    return handler


@events.on("appointment.confirmed")
def notify_customer_appointment_confirmed(appointment, **_kwargs) -> None:
    _notify_customer(appointment, "appointment.confirmed")


@events.on("appointment.cancelled")
def notify_customer_appointment_cancelled(appointment, **_kwargs) -> None:
    _notify_customer(appointment, "appointment.cancelled")


@events.on("appointment.rescheduled")
def notify_employee_appointment_rescheduled(new_appointment, **_kwargs) -> None:
    _notify_employee_internal(new_appointment, "appointment.rescheduled")


for _event_code in _INTERNAL_ONLY_EVENTS:
    events.subscribe(_event_code, _make_internal_handler(_event_code))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest apps/notifications/tests/test_handlers.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full appointments suite to check nothing broke**

Run: `cd backend && python -m pytest apps/appointments -v`
Expected: PASS — the appointments engine doesn't depend on notifications, but this confirms the new event subscribers don't raise inside `TransitionAppointmentUseCase.transition`/`reschedule` (which would otherwise be swallowed by `core/events.py` as a logged error, silently breaking these tests' assumptions about notification side effects being active).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/notifications/handlers.py backend/apps/notifications/tests/test_handlers.py
git commit -m "feat(notifications): subscribe appointment lifecycle events to notifications"
```

---

### Task 5: Reminder Celery task

**Files:**
- Create: `backend/apps/notifications/tasks.py`
- Create: `backend/apps/notifications/tests/test_tasks.py`
- Modify: `backend/config/settings/base.py` (add `CELERY_BEAT_SCHEDULE`)

**Interfaces:**
- Consumes: `apps.notifications.models.{Notification, NotificationSetting}` (Task 1), `apps.notifications.services.NotifyEventUseCase` (Task 3), `apps.appointments.models.{Appointment, AppointmentStatus}` (existing).
- Produces: `apps.notifications.tasks.send_appointment_reminders() -> int` (Celery shared task, name `"notifications.send_appointment_reminders"`), registered in `CELERY_BEAT_SCHEDULE` under key `"send-appointment-reminders"`.

- [ ] **Step 1: Write the failing task tests**

`backend/apps/notifications/tests/test_tasks.py`:

```python
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationSetting,
    NotificationTemplate,
)
from apps.services.models import Employee, Service

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _reminder_template():
    NotificationTemplate.objects.create(
        organization=None,
        event_code="appointment.reminder",
        channel=NotificationChannel.EMAIL,
        body_template="Recordatorio para {{ customer_name }}",
    )


def _appointment_starting_in(hours, *, organization, branch, service, employee, customer):
    start_dt = timezone.now() + timedelta(hours=hours)
    return Appointment.objects.all_objects.create(
        organization=organization,
        branch=branch,
        customer=customer,
        service=service,
        employee=employee,
        appointment_date=start_dt.date(),
        start_time=start_dt.time().replace(microsecond=0),
        end_time=(start_dt + timedelta(minutes=30)).time().replace(microsecond=0),
        duration_minutes=30,
        price="10.00",
        status=AppointmentStatus.CONFIRMED,
    )


class TestSendAppointmentReminders:
    def test_genera_recordatorio_dentro_de_la_ventana(self, organization, branch, service, employee, customer):
        from apps.notifications.tasks import send_appointment_reminders

        NotificationSetting.objects.all_objects.create(
            organization=organization, reminder_offsets_hours=[24], enabled_channels=["email"]
        )
        appt = _appointment_starting_in(
            24, organization=organization, branch=branch, service=service, employee=employee, customer=customer
        )

        count = send_appointment_reminders()

        assert count == 1
        assert Notification.objects.all_objects.filter(
            appointment=appt, event_code="appointment.reminder"
        ).exists()

    def test_no_duplica_si_ya_se_envio_para_ese_offset(self, organization, branch, service, employee, customer):
        from apps.notifications.tasks import send_appointment_reminders

        NotificationSetting.objects.all_objects.create(
            organization=organization, reminder_offsets_hours=[24], enabled_channels=["email"]
        )
        appt = _appointment_starting_in(
            24, organization=organization, branch=branch, service=service, employee=employee, customer=customer
        )

        send_appointment_reminders()
        second_count = send_appointment_reminders()

        assert second_count == 0
        assert (
            Notification.objects.all_objects.filter(
                appointment=appt, event_code="appointment.reminder"
            ).count()
            == 1
        )

    def test_fuera_de_la_ventana_no_genera_recordatorio(self, organization, branch, service, employee, customer):
        from apps.notifications.tasks import send_appointment_reminders

        NotificationSetting.objects.all_objects.create(
            organization=organization, reminder_offsets_hours=[24], enabled_channels=["email"]
        )
        _appointment_starting_in(
            30, organization=organization, branch=branch, service=service, employee=employee, customer=customer
        )

        assert send_appointment_reminders() == 0

    def test_organizacion_sin_configuracion_no_genera_recordatorios(
        self, organization, other_organization, branch, service, employee, customer
    ):
        from apps.notifications.tasks import send_appointment_reminders

        # `organization` no tiene NotificationSetting; `other_organization` tampoco.
        other_branch = Branch.objects.all_objects.create(organization=other_organization, name="Otra sede")
        other_service = Service.objects.all_objects.create(
            organization=other_organization, name="Otro servicio", duration_minutes=30, price="5.00"
        )
        other_employee = Employee.objects.all_objects.create(
            organization=other_organization, branch=other_branch, first_name="Beto", last_name="Otro"
        )
        other_customer = Customer.objects.all_objects.create(
            organization=other_organization, first_name="Cliente", last_name="Otro"
        )
        _appointment_starting_in(
            24,
            organization=other_organization,
            branch=other_branch,
            service=other_service,
            employee=other_employee,
            customer=other_customer,
        )

        assert send_appointment_reminders() == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest apps/notifications/tests/test_tasks.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'apps.notifications.tasks'`.

- [ ] **Step 3: Implement the task**

`backend/apps/notifications/tasks.py`:

```python
from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.appointments.models import Appointment, AppointmentStatus
from apps.notifications.models import Notification, NotificationSetting
from apps.notifications.services import NotifyEventUseCase

_REMINDER_WINDOW = timedelta(minutes=15)


def _appointment_context(appointment) -> dict:
    return {
        "customer_name": f"{appointment.customer.first_name} {appointment.customer.last_name}",
        "service_name": appointment.service.name,
        "appointment_date": appointment.appointment_date.isoformat(),
        "start_time": appointment.start_time.strftime("%H:%M"),
    }


@shared_task(name="notifications.send_appointment_reminders")
def send_appointment_reminders() -> int:
    """Tarea periódica (Celery beat, cada 15 min): dispara recordatorios configurados por organización."""

    now = timezone.now()
    sent_count = 0

    for setting in NotificationSetting.objects.all_objects.select_related("organization"):
        for offset_hours in setting.reminder_offsets_hours:
            window_start = now + timedelta(hours=offset_hours)
            window_end = window_start + _REMINDER_WINDOW

            appointments = Appointment.objects.all_objects.filter(
                organization=setting.organization,
                status=AppointmentStatus.CONFIRMED,
                time_range__startswith__gte=window_start,
                time_range__startswith__lt=window_end,
            )
            for appointment in appointments:
                already_sent = Notification.objects.all_objects.filter(
                    appointment=appointment,
                    event_code="appointment.reminder",
                    payload__reminder_offset_hours=offset_hours,
                ).exists()
                if already_sent:
                    continue

                context = _appointment_context(appointment)
                context["reminder_offset_hours"] = offset_hours
                NotifyEventUseCase().notify(
                    event_code="appointment.reminder",
                    organization=setting.organization,
                    context=context,
                    customer=appointment.customer,
                    appointment=appointment,
                    channels=setting.enabled_channels,
                )
                sent_count += 1

    return sent_count
```

In `backend/config/settings/base.py`, add after the existing `CELERY_TIMEZONE = TIME_ZONE` line:

```python
CELERY_BEAT_SCHEDULE = {
    "send-appointment-reminders": {
        "task": "notifications.send_appointment_reminders",
        "schedule": timedelta(minutes=15),
    },
}
```

(`timedelta` is already imported at the top of `base.py`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest apps/notifications/tests/test_tasks.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/apps/notifications/tasks.py backend/config/settings/base.py backend/apps/notifications/tests/test_tasks.py
git commit -m "feat(notifications): add appointment reminder Celery beat task"
```

---

### Task 6: Internal API (list + mark-as-read)

**Files:**
- Create: `backend/apps/notifications/serializers.py`
- Create: `backend/apps/notifications/views.py`
- Create: `backend/apps/notifications/urls.py`
- Create: `backend/apps/notifications/tests/test_api.py`
- Modify: `backend/config/urls.py` (add `path("api/notifications/", include("apps.notifications.urls"))`, after the `appointments` line)

**Interfaces:**
- Consumes: `apps.notifications.models.Notification` (Task 1), `apps.notifications.services.MarkNotificationReadUseCase` (Task 3).
- Produces: `GET /api/notifications/` (paginated, filterable by `?status=`), `POST /api/notifications/{id}/read/`. Consumed by the frontend in Task 8.

- [ ] **Step 1: Write the failing API tests**

`backend/apps/notifications/tests/test_api.py`:

```python
import pytest

from apps.notifications.models import Notification, NotificationChannel, NotificationStatus

pytestmark = pytest.mark.django_db


@pytest.fixture
def notification(organization, org_admin_user):
    return Notification.objects.all_objects.create(
        organization=organization,
        recipient_user=org_admin_user,
        channel=NotificationChannel.INTERNAL,
        event_code="appointment.created",
        status=NotificationStatus.SENT,
    )


@pytest.fixture
def other_user_notification(organization, make_user):
    other = make_user(organization, "otro-staff@test.com")
    return Notification.objects.all_objects.create(
        organization=organization,
        recipient_user=other,
        channel=NotificationChannel.INTERNAL,
        event_code="appointment.created",
        status=NotificationStatus.SENT,
    )


class TestNotificationListAPI:
    def test_lista_solo_las_propias(self, auth_client, notification, other_user_notification):
        response = auth_client.get("/api/notifications/")
        assert response.status_code == 200
        ids = [item["id"] for item in response.data["results"]]
        assert str(notification.id) in ids
        assert str(other_user_notification.id) not in ids

    def test_requiere_autenticacion(self, api_client):
        response = api_client.get("/api/notifications/")
        assert response.status_code == 401

    def test_filtra_por_status(self, auth_client, notification):
        notification.status = NotificationStatus.READ
        notification.save(update_fields=["status"])

        response = auth_client.get("/api/notifications/", {"status": "sent"})

        assert response.status_code == 200
        assert response.data["results"] == []


class TestNotificationMarkReadAPI:
    def test_marca_como_leida(self, auth_client, notification):
        response = auth_client.post(f"/api/notifications/{notification.id}/read/")
        assert response.status_code == 200
        notification.refresh_from_db()
        assert notification.status == NotificationStatus.READ

    def test_404_para_notificacion_de_otro_usuario(self, auth_client, other_user_notification):
        response = auth_client.post(f"/api/notifications/{other_user_notification.id}/read/")
        assert response.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest apps/notifications/tests/test_api.py -v`
Expected: FAIL — `404` for all routes (URLs not wired) or `ModuleNotFoundError` for `apps.notifications.views`.

- [ ] **Step 3: Implement the API**

`backend/apps/notifications/serializers.py`:

```python
from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "channel",
            "event_code",
            "status",
            "payload",
            "appointment",
            "sent_at",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields
```

`backend/apps/notifications/views.py`:

```python
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import MarkNotificationReadUseCase


class NotificationListView(ListAPIView):
    """Notificaciones internas del usuario autenticado (no requiere permiso de recurso: es siempre 'lo propio')."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status"]

    def get_queryset(self):
        return Notification.objects.filter(recipient_user=self.request.user)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notification = MarkNotificationReadUseCase().mark_read(notification_id=pk, user=request.user)
        return Response(NotificationSerializer(notification).data)
```

`backend/apps/notifications/urls.py`:

```python
from django.urls import path

from apps.notifications.views import NotificationListView, NotificationMarkReadView

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("<uuid:pk>/read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
]
```

In `backend/config/urls.py`, add after the `appointments` line:

```python
    path("api/notifications/", include("apps.notifications.urls")),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest apps/notifications/tests/test_api.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full notifications suite**

Run: `cd backend && python -m pytest apps/notifications -v`
Expected: PASS (all tests from Tasks 1–6).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/notifications/serializers.py backend/apps/notifications/views.py backend/apps/notifications/urls.py backend/config/urls.py backend/apps/notifications/tests/test_api.py
git commit -m "feat(notifications): add internal notifications API (list + mark-as-read)"
```

---

### Task 7: Seed data (global templates + per-organization reminder settings)

**Files:**
- Create: `backend/apps/notifications/management/commands/seed_notification_templates.py`
- Modify: `backend/apps/organizations/management/commands/seed_demo.py`

**Interfaces:**
- Consumes: `apps.notifications.models.{NotificationChannel, NotificationTemplate, NotificationSetting}` (Task 1).
- Produces: idempotent global `NotificationTemplate` rows for every event code used by Task 4/5's handlers and reminder task; `NotificationSetting(reminder_offsets_hours=[24, 2], enabled_channels=["email"])` for the two demo organizations. No new tests — this is seed/demo data, verified manually per the "cómo probarlo" section at the end of this plan.

- [ ] **Step 1: Create the template seed command**

`backend/apps/notifications/management/commands/seed_notification_templates.py`:

```python
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.notifications.models import NotificationChannel, NotificationTemplate

_GLOBAL_TEMPLATES = [
    {
        "event_code": "appointment.confirmed",
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Tu cita fue confirmada",
        "body_template": (
            "Hola {{ customer_name }}, tu cita de {{ service_name }} el {{ appointment_date }} "
            "a las {{ start_time }} en {{ branch_name }} fue confirmada."
        ),
    },
    {
        "event_code": "appointment.cancelled",
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Tu cita fue cancelada",
        "body_template": (
            "Hola {{ customer_name }}, tu cita de {{ service_name }} el {{ appointment_date }} "
            "a las {{ start_time }} fue cancelada."
        ),
    },
    {
        "event_code": "appointment.reminder",
        "channel": NotificationChannel.EMAIL,
        "subject_template": "Recordatorio de tu cita",
        "body_template": (
            "Te recordamos tu cita de {{ service_name }} el {{ appointment_date }} a las {{ start_time }}."
        ),
    },
    {
        "event_code": "appointment.created",
        "channel": NotificationChannel.INTERNAL,
        "subject_template": "",
        "body_template": (
            "Nueva cita: {{ customer_name }} · {{ service_name }} el {{ appointment_date }} {{ start_time }}."
        ),
    },
    {
        "event_code": "appointment.waiting",
        "channel": NotificationChannel.INTERNAL,
        "subject_template": "",
        "body_template": "{{ customer_name }} está en espera para {{ service_name }}.",
    },
    {
        "event_code": "appointment.in_progress",
        "channel": NotificationChannel.INTERNAL,
        "subject_template": "",
        "body_template": "Inició la atención de {{ customer_name }} · {{ service_name }}.",
    },
    {
        "event_code": "appointment.completed",
        "channel": NotificationChannel.INTERNAL,
        "subject_template": "",
        "body_template": "Se completó la cita de {{ customer_name }} · {{ service_name }}.",
    },
    {
        "event_code": "appointment.no_show",
        "channel": NotificationChannel.INTERNAL,
        "subject_template": "",
        "body_template": "{{ customer_name }} no asistió a su cita de {{ service_name }}.",
    },
    {
        "event_code": "appointment.rescheduled",
        "channel": NotificationChannel.INTERNAL,
        "subject_template": "",
        "body_template": (
            "Se reprogramó la cita de {{ customer_name }} · {{ service_name }} "
            "para {{ appointment_date }} {{ start_time }}."
        ),
    },
]


class Command(BaseCommand):
    help = "Crea las plantillas de notificación globales por defecto (idempotente)."

    @transaction.atomic
    def handle(self, *args, **options):
        for data in _GLOBAL_TEMPLATES:
            NotificationTemplate.objects.update_or_create(
                organization=None,
                event_code=data["event_code"],
                channel=data["channel"],
                defaults={
                    "subject_template": data["subject_template"],
                    "body_template": data["body_template"],
                    "is_active": True,
                },
            )
        self.stdout.write(self.style.SUCCESS(f"{len(_GLOBAL_TEMPLATES)} plantillas globales sincronizadas."))
```

- [ ] **Step 2: Run it manually to verify it's idempotent**

Run: `cd backend && python manage.py seed_notification_templates && python manage.py seed_notification_templates`
Expected: both runs print `9 plantillas globales sincronizadas.` with no errors; a second run doesn't create duplicates (verify with `python manage.py shell -c "from apps.notifications.models import NotificationTemplate; print(NotificationTemplate.objects.count())"` — should stay at 9).

- [ ] **Step 3: Extend `seed_demo`**

In `backend/apps/organizations/management/commands/seed_demo.py`:

Add to the imports:

```python
from apps.notifications.models import NotificationSetting
```

Change the `call_command("seed_rbac")` line at the top of `handle()` to also seed templates:

```python
        call_command("seed_rbac")
        call_command("seed_notification_templates")
```

Inside the `if created:` block for `motors` (after the `_seed_schedules_and_appointments(...)` call), add:

```python
            NotificationSetting.objects.all_objects.create(
                organization=motors, reminder_offsets_hours=[24, 2], enabled_channels=["email"]
            )
```

Inside the `if created:` block for `labx` (after its `_seed_schedules_and_appointments(...)` call), add:

```python
            NotificationSetting.objects.all_objects.create(
                organization=labx, reminder_offsets_hours=[24, 2], enabled_channels=["email"]
            )
```

- [ ] **Step 4: Run the existing organizations test suite to confirm nothing broke**

Run: `cd backend && python -m pytest apps/organizations -v`
Expected: PASS (seed_demo isn't directly unit-tested today per the checklist — this just confirms no import errors were introduced into the app).

- [ ] **Step 5: Commit**

```bash
git add backend/apps/notifications/management backend/apps/organizations/management/commands/seed_demo.py
git commit -m "feat(notifications): seed global templates and demo reminder settings"
```

---

### Task 8: Frontend — notification bell

**Files:**
- Create: `frontend/src/types/notification.ts`
- Create: `frontend/src/features/notifications/api.ts`
- Create: `frontend/src/features/notifications/NotificationBell.tsx`
- Create: `frontend/src/features/notifications/NotificationBell.test.tsx`
- Modify: `frontend/src/components/AppLayout.tsx` (render `<NotificationBell />` in the header)

**Interfaces:**
- Consumes: `apiClient` (`frontend/src/api/client.ts`, existing), `Paginated<T>` (`frontend/src/types/api.ts`, existing), backend endpoints from Task 6 (`GET /api/notifications/`, `POST /api/notifications/{id}/read/`).
- Produces: `listNotifications(params) -> Promise<Paginated<Notification>>`, `markNotificationRead(id) -> Promise<Notification>`, `<NotificationBell />` component mounted in `AppLayout`.

- [ ] **Step 1: Write the failing component test**

`frontend/src/types/notification.ts`:

```typescript
export interface Notification {
  id: string;
  channel: "email" | "sms" | "whatsapp" | "internal";
  event_code: string;
  status: "queued" | "sent" | "failed" | "read";
  payload: Record<string, unknown>;
  appointment: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}
```

`frontend/src/features/notifications/NotificationBell.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { NotificationBell } from "@/features/notifications/NotificationBell";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const sampleNotification = {
  id: "1",
  channel: "internal",
  event_code: "appointment.created",
  status: "sent",
  payload: {},
  appointment: null,
  sent_at: "2026-01-01T00:00:00Z",
  read_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("muestra el contador de notificaciones no leídas", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 1, next: null, previous: null, results: [sampleNotification] },
    });

    render(<NotificationBell />);

    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });

  it("no muestra contador cuando no hay notificaciones", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(<NotificationBell />);

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("marca como leída al hacer click y la quita de la lista", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 1, next: null, previous: null, results: [sampleNotification] },
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { ...sampleNotification, status: "read" } });

    render(<NotificationBell />);

    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Notificaciones"));
    fireEvent.click(screen.getByText("Nueva cita"));

    await waitFor(() => expect(screen.queryByText("Nueva cita")).not.toBeInTheDocument());
    expect(apiClient.post).toHaveBeenCalledWith("/notifications/1/read/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/notifications/NotificationBell.test.tsx`
Expected: FAIL — `Cannot find module '@/features/notifications/NotificationBell'`.

- [ ] **Step 3: Implement the API client and component**

`frontend/src/features/notifications/api.ts`:

```typescript
import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Notification } from "@/types/notification";

export interface NotificationListParams {
  status?: string;
}

export async function listNotifications(params: NotificationListParams = {}): Promise<Paginated<Notification>> {
  const response = await apiClient.get<Paginated<Notification>>("/notifications/", { params });
  return response.data;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const response = await apiClient.post<Notification>(`/notifications/${id}/read/`);
  return response.data;
}
```

`frontend/src/features/notifications/NotificationBell.tsx`:

```tsx
import { useEffect, useState } from "react";

import { listNotifications, markNotificationRead } from "@/features/notifications/api";
import type { Notification } from "@/types/notification";

const EVENT_LABELS: Record<string, string> = {
  "appointment.confirmed": "Cita confirmada",
  "appointment.cancelled": "Cita cancelada",
  "appointment.created": "Nueva cita",
  "appointment.waiting": "Cliente en espera",
  "appointment.in_progress": "Cita en proceso",
  "appointment.completed": "Cita completada",
  "appointment.no_show": "Cliente no asistió",
  "appointment.rescheduled": "Cita reprogramada",
  "appointment.reminder": "Recordatorio de cita",
};

function describeNotification(notification: Notification): string {
  return EVENT_LABELS[notification.event_code] ?? notification.event_code;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    listNotifications({ status: "sent" })
      .then((page) => setNotifications(page.results))
      .catch(() => setNotifications([]));
  }, []);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="notification-bell">
      <button type="button" onClick={() => setIsOpen((open) => !open)} aria-label="Notificaciones">
        🔔{notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
      </button>
      {isOpen && (
        <div className="notification-dropdown">
          {notifications.length === 0 && <p>No hay notificaciones nuevas.</p>}
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button type="button" onClick={() => handleMarkRead(notification.id)}>
                  {describeNotification(notification)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

Modify `frontend/src/components/AppLayout.tsx`:

```tsx
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { NotificationBell } from "@/features/notifications/NotificationBell";

export function AppLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <nav>
          <Link to="/citas">Agenda</Link>
          <Link to="/clientes">Clientes</Link>
          <Link to="/servicios">Servicios</Link>
          <Link to="/profesionales">Profesionales</Link>
        </nav>
        <NotificationBell />
        <button type="button" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/notifications/NotificationBell.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run full frontend verification**

Run: `cd frontend && npx tsc -b && npx eslint . && npx vitest run`
Expected: no type errors, no lint errors, all tests (including pre-existing `CustomerListPage.test.tsx`, `ServiceListPage.test.tsx`, `CalendarPage.test.tsx`) pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/notification.ts frontend/src/features/notifications frontend/src/components/AppLayout.tsx
git commit -m "feat(notifications): add notification bell to the app layout"
```

---

## Closing this phase (after all 8 tasks)

Per `CLAUDE.md`'s "una fase está terminada cuando..." checklist:

1. Run the full backend suite against a real PostgreSQL instance (per `docs/checklist.md`, Fases 2–5 already have this step pending until Docker/Postgres is up — Fase 6 joins that same pending batch): `docker compose up -d db redis` then `cd backend && python -m pytest --cov`.
2. Run `cd backend && python manage.py seed_demo` against that same database and manually verify: `NotificationTemplate` has 9 global rows, both demo organizations have a `NotificationSetting`, and creating/confirming/cancelling an appointment via the API produces `Notification` rows (`GET /api/notifications/` as the assigned professional's user, or `GET /api/audit-logs/`-style inspection via Django admin at `/admin/`).
3. Manually trigger the reminder task once against real data: `cd backend && python manage.py shell -c "from apps.notifications.tasks import send_appointment_reminders; print(send_appointment_reminders())"`.
4. Update `docs/checklist.md`: check off every Fase 6 item once verified, and update the "Suite de tests corrida..." pending line the same way Fases 2–5 already track it.
5. Propose the final conventional commit for the phase closure docs update (`docs: mark Fase 6 items complete in checklist`) — separate from the 8 feature commits above.
