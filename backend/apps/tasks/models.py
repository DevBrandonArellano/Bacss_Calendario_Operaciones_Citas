from __future__ import annotations

from django.db import models

from core.models import TenantAwareModel, TimeStampedModel


class TaskOwnerType(models.TextChoices):
    CUSTOMER = "customer", "Cliente"
    APPOINTMENT = "appointment", "Cita"
    CASE = "case", "Caso legal"
    WORK_ORDER = "work_order", "Orden de trabajo"
    ORDER = "order", "Pedido"


class TaskPriority(models.TextChoices):
    LOW = "low", "Baja"
    MEDIUM = "medium", "Media"
    HIGH = "high", "Alta"


class TaskStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    IN_PROGRESS = "in_progress", "En progreso"
    COMPLETED = "completed", "Completada"
    CANCELLED = "cancelled", "Cancelada"


class Task(TenantAwareModel, TimeStampedModel):
    """Tarea genérica asociable (docs/erd.md: distinta de `CaseTask`, que
    es propia del módulo Legal). Mismo patrón `owner_type`/`owner_id` y
    control de acceso que `Document` (`core/owner_access.py`)."""

    owner_type = models.CharField(max_length=20, choices=TaskOwnerType.choices)
    owner_id = models.UUIDField()
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    assigned_to_user = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, related_name="+", null=True, blank=True
    )
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=10, choices=TaskPriority.choices, default=TaskPriority.MEDIUM)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING)

    class Meta:
        ordering = ["due_date"]
        indexes = [models.Index(fields=["organization", "owner_type", "owner_id"])]

    def __str__(self) -> str:
        return self.title
