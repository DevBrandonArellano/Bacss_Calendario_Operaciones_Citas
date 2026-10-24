from __future__ import annotations

import uuid

from django.db import models

from core.context import get_current_organization_id, is_tenant_scope_bypassed


class AuditAction(models.TextChoices):
    LOGIN = "login", "Inicio de sesión"
    LOGOUT = "logout", "Cierre de sesión"
    CREATE = "create", "Creación"
    READ = "read", "Lectura"
    UPDATE = "update", "Actualización"
    DELETE = "delete", "Eliminación"
    DOWNLOAD = "download", "Descarga"
    PERMISSION_CHANGE = "permission_change", "Cambio de permisos"


class ImmutableQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionError("AuditLog es inmutable: no se permite update().")

    def delete(self):
        raise PermissionError("AuditLog es inmutable: no se permite delete().")


class AuditLogManager(models.Manager):
    """Manager por defecto de AuditLog: inmutable + aislado por tenant.

    AuditLog no hereda de `TenantAwareModel` (core/models.py) porque su
    `organization` es nullable —hay eventos de plataforma sin organización—
    mientras que `TenantAwareModel.organization` es obligatorio. Por esa
    diferencia de forma, este manager replica la misma regla de
    `TenantAwareManager.get_queryset()` (regla #1 de CLAUDE.md: ninguna
    consulta de negocio debe poder devolver datos de otra organización) en
    vez de heredarla, para que `AuditLog.objects` no sea la excepción que
    depende de que cada vista se acuerde de filtrar a mano.
    """

    def get_queryset(self) -> ImmutableQuerySet:
        qs = ImmutableQuerySet(self.model, using=self._db)
        if is_tenant_scope_bypassed():
            return qs
        organization_id = get_current_organization_id()
        if organization_id is None:
            return qs.none()
        return qs.filter(organization_id=organization_id)


class AllAuditLogsManager(models.Manager):
    """Sin filtro de tenant — mismo uso restringido que `UnscopedManager`
    (core/models.py): solo superadmin de plataforma o comandos de sistema,
    nunca desde una vista de la API normal."""

    def get_queryset(self) -> ImmutableQuerySet:
        return ImmutableQuerySet(self.model, using=self._db)


class AuditLog(models.Model):
    """Registro de auditoría inmutable (docs/logging.md, docs/security-iso27001.md).

    No hereda de TimeStampedModel (no necesita `updated_at`, nunca se
    actualiza) ni de SoftDeleteModel (no se borra ni lógica ni físicamente
    desde la aplicación).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.PROTECT,
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=30, choices=AuditAction.choices)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=64, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    correlation_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AuditLogManager()
    all_objects = AllAuditLogsManager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "entity_type", "entity_id"]),
            models.Index(fields=["organization", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.action} · {self.entity_type}:{self.entity_id}"

    def save(self, *args, **kwargs):
        # `all_objects` a propósito: esta es una verificación de integridad
        # sobre el estado real en DB, no una consulta de negocio — no debe
        # depender de qué organización esté fijada en el contexto actual (p.
        # ej. una tarea de Celery sin tenant_scope() activo vería `objects`
        # vacío y dejaría pasar un update real hacia la fila existente).
        if self.pk and AuditLog.all_objects.filter(pk=self.pk).exists():
            raise PermissionError("AuditLog es inmutable: no se permite modificar un registro existente.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("AuditLog es inmutable: no se permite eliminar registros.")
