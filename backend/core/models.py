from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from core.context import get_current_organization_id, is_tenant_scope_bypassed


class TimeStampedModel(models.Model):
    """Agrega `created_at`/`updated_at` administrados automáticamente."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self) -> SoftDeleteQuerySet:
        return self.filter(deleted_at__isnull=True)

    def dead(self) -> SoftDeleteQuerySet:
        return self.filter(deleted_at__isnull=False)

    def delete(self):
        return self.update(deleted_at=timezone.now())


class SoftDeleteModel(models.Model):
    """Borrado lógico: `delete()` marca `deleted_at` en vez de eliminar la fila."""

    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteQuerySet.as_manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False, hard=False):
        if hard:
            return super().delete(using=using, keep_parents=keep_parents)
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at"])
        return None

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class TenantAwareQuerySet(models.QuerySet):
    """Queryset que se filtra por la organización del contexto actual.

    El filtrado ocurre en `TenantAwareManager.get_queryset()`, no aquí; este
    queryset existe para poder encadenar `.alive()` con `SoftDeleteQuerySet`
    cuando un modelo hereda de ambos.
    """


class TenantAwareManager(models.Manager):
    """Manager por defecto: SIEMPRE filtra por la organización actual.

    Regla crítica (ver CLAUDE.md): el `organization_id` nunca se toma de un
    parámetro del cliente, solo del contexto resuelto por
    `core.middleware.CurrentOrganizationMiddleware` a partir del usuario
    autenticado.
    """

    def get_queryset(self) -> models.QuerySet:
        qs = super().get_queryset()
        if is_tenant_scope_bypassed():
            return qs
        organization_id = get_current_organization_id()
        if organization_id is None:
            # Sin organización en contexto: no se filtra por accidente con
            # un valor equivocado, se devuelve vacío por seguridad.
            return qs.none()
        return qs.filter(organization_id=organization_id)


class UnscopedManager(models.Manager):
    """Manager sin ningún filtro de tenant.

    Uso exclusivo de código de plataforma (superadmin, comandos de
    management, tareas de sistema) explícitamente marcado como tal. No debe
    usarse desde vistas de la API normal.
    """

    def get_queryset(self) -> models.QuerySet:
        return super().get_queryset()


class TenantAwareModel(models.Model):
    """Todo modelo de negocio hereda de aquí (regla #1 de CLAUDE.md)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="%(class)s_set",
    )

    objects = TenantAwareManager()
    all_objects = UnscopedManager()

    class Meta:
        abstract = True
