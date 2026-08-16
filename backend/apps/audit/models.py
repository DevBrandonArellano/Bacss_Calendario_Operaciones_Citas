from __future__ import annotations

import uuid

from django.db import models


class AuditAction(models.TextChoices):
    LOGIN = "login", "Inicio de sesión"
    LOGOUT = "logout", "Cierre de sesión"
    CREATE = "create", "Creación"
    READ = "read", "Lectura"
    UPDATE = "update", "Actualización"
    DELETE = "delete", "Eliminación"
    DOWNLOAD = "download", "Descarga"
    PERMISSION_CHANGE = "permission_change", "Cambio de permisos"


class ImmutableManager(models.Manager):
    """Solo permite `create`; `update`/`delete` sobre el queryset están bloqueados."""

    def get_queryset(self):
        return ImmutableQuerySet(self.model, using=self._db)


class ImmutableQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionError("AuditLog es inmutable: no se permite update().")

    def delete(self):
        raise PermissionError("AuditLog es inmutable: no se permite delete().")


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

    objects = ImmutableManager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "entity_type", "entity_id"]),
            models.Index(fields=["organization", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.action} · {self.entity_type}:{self.entity_id}"

    def save(self, *args, **kwargs):
        if self.pk and AuditLog.objects.filter(pk=self.pk).exists():
            raise PermissionError("AuditLog es inmutable: no se permite modificar un registro existente.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("AuditLog es inmutable: no se permite eliminar registros.")
