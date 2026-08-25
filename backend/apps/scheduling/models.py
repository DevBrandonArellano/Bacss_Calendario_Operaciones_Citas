from django.db import models
from django.db.models import Q

from core.models import TenantAwareModel, TimeStampedModel


class Weekday(models.IntegerChoices):
    """Convención Python `date.weekday()`: lunes=0 ... domingo=6."""

    MONDAY = 0, "Lunes"
    TUESDAY = 1, "Martes"
    WEDNESDAY = 2, "Miércoles"
    THURSDAY = 3, "Jueves"
    FRIDAY = 4, "Viernes"
    SATURDAY = 5, "Sábado"
    SUNDAY = 6, "Domingo"


class Schedule(TenantAwareModel, TimeStampedModel):
    """Horario laboral recurrente de una sucursal y/o de un empleado.

    Un tramo con `is_break=True` representa un descanso (almuerzo, etc.)
    dentro del horario laboral, no un horario laboral adicional.
    """

    branch = models.ForeignKey(
        "branches.Branch", on_delete=models.CASCADE, related_name="schedules", null=True, blank=True
    )
    employee = models.ForeignKey(
        "services.Employee", on_delete=models.CASCADE, related_name="schedules", null=True, blank=True
    )
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_break = models.BooleanField(default=False)

    class Meta:
        ordering = ["weekday", "start_time"]
        constraints = [
            models.CheckConstraint(
                condition=Q(branch__isnull=False) | Q(employee__isnull=False),
                name="schedule_requires_branch_or_employee",
            ),
            models.CheckConstraint(
                condition=Q(start_time__lt=models.F("end_time")), name="schedule_start_before_end"
            ),
        ]

    def __str__(self) -> str:
        owner = self.employee or self.branch
        return f"{owner} · {self.get_weekday_display()} {self.start_time}-{self.end_time}"


class BlockReason(models.TextChoices):
    VACATION = "vacation", "Vacaciones"
    HOLIDAY = "holiday", "Feriado"
    MANUAL_BLOCK = "manual_block", "Bloqueo manual"
    ABSENCE = "absence", "Ausencia"


class AvailabilityBlock(TenantAwareModel, TimeStampedModel):
    """Excepción puntual a un horario recurrente para una fecha concreta.

    `employee` y `branch` en null simultáneamente representa un bloqueo a
    nivel de toda la organización (p. ej. un feriado nacional).
    """

    employee = models.ForeignKey(
        "services.Employee",
        on_delete=models.CASCADE,
        related_name="availability_blocks",
        null=True,
        blank=True,
    )
    branch = models.ForeignKey(
        "branches.Branch", on_delete=models.CASCADE, related_name="availability_blocks", null=True, blank=True
    )
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    reason = models.CharField(max_length=20, choices=BlockReason.choices)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["date", "start_time"]
        constraints = [
            models.CheckConstraint(
                condition=Q(start_time__lt=models.F("end_time")),
                name="availability_block_start_before_end",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_reason_display()} {self.date} {self.start_time}-{self.end_time}"
