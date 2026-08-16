"""Control de acceso a recursos asociables genéricos (`Document`, `Task`,
Fase 11B): ambos usan el mismo par `owner_type`/`owner_id` en vez de una FK
tipada, así que el permiso requerido depende del tipo de propietario, no
del modelo `Document`/`Task` en sí. Un tipo nuevo solo agrega una entrada
aquí, sin tocar `apps/documents` ni `apps/tasks` (Open/Closed).
"""

from __future__ import annotations

from core import exceptions as domain_exceptions

# owner_type -> (permiso de lectura, permiso de escritura)
OWNER_TYPE_PERMISSIONS: dict[str, tuple[str, str]] = {
    "customer": ("customers:read", "customers:write"),
    "appointment": ("appointments:read", "appointments:write"),
    "case": ("legal:read", "legal:write"),
    "work_order": ("moto:read", "moto:write"),
    "patient": ("laboratory:read", "laboratory:write"),
    "order": ("store:read", "store:write"),
}


def check_owner_permission(user, owner_type: str, owner_id, *, write: bool) -> None:
    """Lanza `PermissionDeniedError`/`ValidationError` si el usuario no
    puede acceder al propietario indicado. No verifica que `owner_id`
    exista (eso lo valida el caso de uso al crear); aquí solo se decide
    autorización."""

    codes = OWNER_TYPE_PERMISSIONS.get(owner_type)
    if codes is None:
        raise domain_exceptions.ValidationError(f"Tipo de propietario '{owner_type}' no soportado.")

    if getattr(user, "is_platform_superadmin", False):
        return

    code = codes[1] if write else codes[0]
    if not user.has_permission(code):
        raise domain_exceptions.PermissionDeniedError("No tiene permiso para acceder a este recurso.")

    if owner_type == "case":
        _check_case_scope(user, owner_id)


def _check_case_scope(user, case_id) -> None:
    """Un profesional sin `legal:read_all` solo accede a documentos/tareas
    de sus propios casos (mismo alcance que `LegalCaseViewSet`, Fase 11)."""

    if getattr(user, "is_platform_superadmin", False) or user.has_permission("legal:read_all"):
        return

    from apps.modules.legal.models import LegalCase

    employee = getattr(user, "employee_profile", None)
    if employee is None or not LegalCase.objects.filter(id=case_id, responsible_lawyer=employee).exists():
        raise domain_exceptions.PermissionDeniedError("No tiene acceso a este caso.")
