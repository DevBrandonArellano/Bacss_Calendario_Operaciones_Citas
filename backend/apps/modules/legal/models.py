from __future__ import annotations

from django.db import models
from django.utils import timezone

from core.models import TenantAwareModel, TimeStampedModel


class CasePriority(models.TextChoices):
    LOW = "low", "Baja"
    MEDIUM = "medium", "Media"
    HIGH = "high", "Alta"


class LegalCaseStatus(models.TextChoices):
    NEW = "new", "Nuevo"
    IN_REVIEW = "in_review", "En revisión"
    ACTIVE = "active", "Activo"
    ON_HOLD = "on_hold", "En espera"
    CLOSED = "closed", "Cerrado"
    ARCHIVED = "archived", "Archivado"


VALID_CASE_TRANSITIONS: dict[str, set[str]] = {
    LegalCaseStatus.NEW: {LegalCaseStatus.IN_REVIEW, LegalCaseStatus.CLOSED},
    LegalCaseStatus.IN_REVIEW: {LegalCaseStatus.ACTIVE, LegalCaseStatus.CLOSED},
    LegalCaseStatus.ACTIVE: {LegalCaseStatus.ON_HOLD, LegalCaseStatus.CLOSED},
    LegalCaseStatus.ON_HOLD: {LegalCaseStatus.ACTIVE, LegalCaseStatus.CLOSED},
    LegalCaseStatus.CLOSED: {LegalCaseStatus.ARCHIVED, LegalCaseStatus.ACTIVE},
    LegalCaseStatus.ARCHIVED: set(),
}


class LegalCase(TenantAwareModel, TimeStampedModel):
    """Dato sensible: control de acceso reforzado (docs/auth-rbac.md,
    docs/security-iso27001.md). Un profesional sin el permiso
    `legal:read_all` solo ve los casos donde es `responsible_lawyer`
    (`LegalCaseViewSet.get_queryset`, `apps/modules/legal/views.py`) —
    primera vez que se implementa el "alcance sobre lo propio" descrito en
    `docs/auth-rbac.md` a nivel de queryset, no solo de permiso de módulo.
    """

    case_number = models.CharField(max_length=50)
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="legal_cases")
    case_type = models.CharField(max_length=100)
    responsible_lawyer = models.ForeignKey(
        "services.Employee", on_delete=models.PROTECT, related_name="legal_cases"
    )
    status = models.CharField(max_length=20, choices=LegalCaseStatus.choices, default=LegalCaseStatus.NEW)
    opened_at = models.DateField(default=timezone.now)
    closed_at = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=10, choices=CasePriority.choices, default=CasePriority.MEDIUM)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["-opened_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "case_number"], name="unique_case_number_per_organization"
            )
        ]
        indexes = [models.Index(fields=["organization", "responsible_lawyer", "status"])]

    def __str__(self) -> str:
        return f"{self.case_number} · {self.status}"

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in VALID_CASE_TRANSITIONS.get(self.status, set())


class CaseEvent(TenantAwareModel, TimeStampedModel):
    """Cronología/timeline visible del caso (requisito de la Fase 11,
    distinta de `AuditLog`: esta es de dominio, visible al equipo legal;
    `AuditLog` es el registro de seguridad inmutable). Se crea tanto
    manualmente (notas, llamadas, escritos) como automáticamente en cada
    cambio de estado (`TransitionLegalCaseUseCase`)."""

    legal_case = models.ForeignKey(LegalCase, on_delete=models.CASCADE, related_name="events")
    event_at = models.DateTimeField(default=timezone.now)
    event_type = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    created_by_user = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, related_name="+", null=True, blank=True
    )

    class Meta:
        ordering = ["-event_at"]
        indexes = [models.Index(fields=["organization", "legal_case"])]

    def __str__(self) -> str:
        return f"{self.event_type} · {self.event_at}"


class HearingStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Programada"
    HELD = "held", "Realizada"
    POSTPONED = "postponed", "Postergada"
    CANCELLED = "cancelled", "Cancelada"


class Hearing(TenantAwareModel, TimeStampedModel):
    legal_case = models.ForeignKey(LegalCase, on_delete=models.CASCADE, related_name="hearings")
    scheduled_at = models.DateTimeField()
    location = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=HearingStatus.choices, default=HearingStatus.SCHEDULED)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["scheduled_at"]
        indexes = [models.Index(fields=["organization", "legal_case"])]

    def __str__(self) -> str:
        return f"Audiencia {self.scheduled_at} · {self.status}"


class CaseTaskStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    IN_PROGRESS = "in_progress", "En progreso"
    COMPLETED = "completed", "Completada"
    CANCELLED = "cancelled", "Cancelada"


class CaseTask(TenantAwareModel, TimeStampedModel):
    legal_case = models.ForeignKey(LegalCase, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    assigned_to_user = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, related_name="+", null=True, blank=True
    )
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=10, choices=CasePriority.choices, default=CasePriority.MEDIUM)
    status = models.CharField(max_length=20, choices=CaseTaskStatus.choices, default=CaseTaskStatus.PENDING)

    class Meta:
        ordering = ["due_date"]
        indexes = [models.Index(fields=["organization", "legal_case", "status"])]

    def __str__(self) -> str:
        return f"{self.title} · {self.status}"
