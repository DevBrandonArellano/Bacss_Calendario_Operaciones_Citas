from __future__ import annotations

from apps.audit.models import AuditLog
from core.context import get_correlation_id


def log_action(
    *,
    action: str,
    entity_type: str,
    entity_id: str = "",
    organization=None,
    user=None,
    changes: dict | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Punto único de escritura de auditoría. Ver docs/logging.md."""

    return AuditLog.objects.create(
        organization=organization,
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        changes=changes or {},
        ip_address=ip_address,
        correlation_id=get_correlation_id(),
    )
