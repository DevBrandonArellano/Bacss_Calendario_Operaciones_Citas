from __future__ import annotations

from datetime import datetime

from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeOperators
from django.core.validators import MinValueValidator
from django.db import models
from django.db.backends.postgresql.psycopg_any import DateTimeTZRange
from django.db.models import Q
from django.utils import timezone

from core.models import TenantAwareModel, TimeStampedModel


class AppointmentStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    CONFIRMED = "confirmed", "Confirmada"
    WAITING = "waiting", "En espera"
    IN_PROGRESS = "in_progress", "En proceso"
    COMPLETED = "completed", "Completada"
    CANCELLED = "cancelled", "Cancelada"
    NO_SHOW = "no_show", "No asistió"
    RESCHEDULED = "rescheduled", "Reprogramada"


# Estados que ocupan la agenda del empleado (ver docs/booking-engine.md).
ACTIVE_APPOINTMENT_STATUSES = [
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.WAITING,
    AppointmentStatus.IN_PROGRESS,
]

# Transiciones válidas de la máquina de estados.
VALID_TRANSITIONS: dict[str, set[str]] = {
    AppointmentStatus.PENDING: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
    },
    AppointmentStatus.CONFIRMED: {
        AppointmentStatus.WAITING,
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.RESCHEDULED,
        AppointmentStatus.NO_SHOW,
    },
    AppointmentStatus.WAITING: {AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED},
    AppointmentStatus.IN_PROGRESS: {AppointmentStatus.COMPLETED},
    AppointmentStatus.RESCHEDULED: {AppointmentStatus.PENDING},
    AppointmentStatus.COMPLETED: set(),
    AppointmentStatus.CANCELLED: set(),
    AppointmentStatus.NO_SHOW: set(),
}


class BookingChannel(models.TextChoices):
    ONLINE = "online", "Reserva online"
    STAFF = "staff", "Personal del negocio"
    PHONE = "phone", "Teléfono"
    API = "api", "API pública"


class PaymentStatus(models.TextChoices):
    UNPAID = "unpaid", "Sin pagar"
    PARTIAL = "partial", "Parcial"
    PAID = "paid", "Pagado"
    REFUNDED = "refunded", "Reembolsado"


class Appointment(TenantAwareModel, TimeStampedModel):
    branch = models.ForeignKey("branches.Branch", on_delete=models.PROTECT, related_name="appointments")
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="appointments")
    service = models.ForeignKey("services.Service", on_delete=models.PROTECT, related_name="appointments")
    employee = models.ForeignKey("services.Employee", on_delete=models.PROTECT, related_name="appointments")

    appointment_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    # Rango calculado en save(); base de la protección anti doble-reserva a
    # nivel de base de datos (ver constraint `exclude_overlapping_appointments`).
    time_range = DateTimeRangeField(editable=False, null=True)

    status = models.CharField(
        max_length=20, choices=AppointmentStatus.choices, default=AppointmentStatus.PENDING
    )
    notes = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    payment_status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID
    )
    booking_channel = models.CharField(
        max_length=20, choices=BookingChannel.choices, default=BookingChannel.STAFF
    )

    class Meta:
        ordering = ["appointment_date", "start_time"]
        indexes = [
            models.Index(fields=["organization", "branch", "employee", "appointment_date"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(start_time__lt=models.F("end_time")), name="appointment_start_before_end"
            ),
            ExclusionConstraint(
                name="exclude_overlapping_active_appointments_per_employee",
                expressions=[
                    ("employee", RangeOperators.EQUAL),
                    ("time_range", RangeOperators.OVERLAPS),
                ],
                condition=Q(status__in=ACTIVE_APPOINTMENT_STATUSES),
            ),
        ]

    def __str__(self) -> str:
        return f"{self.customer} · {self.service} · {self.appointment_date} {self.start_time}"

    def save(self, *args, **kwargs):
        if self.appointment_date and self.start_time and self.end_time:
            start_dt = timezone.make_aware(datetime.combine(self.appointment_date, self.start_time))
            end_dt = timezone.make_aware(datetime.combine(self.appointment_date, self.end_time))
            self.time_range = DateTimeTZRange(start_dt, end_dt, bounds="[)")
        super().save(*args, **kwargs)

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in VALID_TRANSITIONS.get(self.status, set())
