"""Contexto de request: organización actual y correlation-id, vía contextvars.

Se usa contextvars (no threading.local) porque es seguro también bajo
ejecución asíncrona y evita fugas entre requests concurrentes.
"""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from uuid import uuid4

_current_organization_id: ContextVar[str | None] = ContextVar("current_organization_id", default=None)
_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")
_bypass_tenant_scope: ContextVar[bool] = ContextVar("bypass_tenant_scope", default=False)


def set_current_organization_id(organization_id: str | None) -> None:
    _current_organization_id.set(str(organization_id) if organization_id else None)


@contextmanager
def tenant_scope(organization_id: str | None):
    """Fija el tenant actual para la duración del bloque y lo restaura al salir.

    Todo caso de uso que reciba `organization` en su constructor debe
    envolver su `execute()` con esto (ver `docs/adr-001-estrategia-multitenant.md`):
    los managers tenant-aware (`TenantAwareManager`, `core/models.py`)
    solo resuelven filas cuando hay un tenant fijado en el contexto, y
    fuera de una request HTTP (tests directos del caso de uso, comandos de
    management, tareas de Celery) nada lo fija automáticamente — a
    diferencia de `CurrentOrganizationMiddleware`, que sí lo hace para
    cada request real.

    Usa el `Token` de `ContextVar.set()` (no un valor capturado a mano)
    para restaurar exactamente el valor anterior al salir, incluso si el
    bloque lanza una excepción o si hay contextos anidados (p. ej. un caso
    de uso que invoca a otro dentro del mismo tenant).
    """

    token = _current_organization_id.set(str(organization_id) if organization_id else None)
    try:
        yield
    finally:
        _current_organization_id.reset(token)


def get_current_organization_id() -> str | None:
    return _current_organization_id.get()


def new_correlation_id() -> str:
    value = str(uuid4())
    _correlation_id.set(value)
    return value


def set_correlation_id(value: str) -> None:
    _correlation_id.set(value)


def get_correlation_id() -> str:
    return _correlation_id.get()


def enable_platform_superadmin_bypass() -> None:
    """Marca explícitamente que el código actual accede sin filtro de tenant.

    Solo debe usarse desde rutas de superadministrador de plataforma,
    claramente auditadas. Ver ADR-001 (docs/adr-001-estrategia-multitenant.md).
    """
    _bypass_tenant_scope.set(True)


def is_tenant_scope_bypassed() -> bool:
    return _bypass_tenant_scope.get()
