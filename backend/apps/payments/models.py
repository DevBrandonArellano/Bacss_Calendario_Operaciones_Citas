from __future__ import annotations

from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantAwareModel, TimeStampedModel


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Efectivo"
    TRANSFER = "transfer", "Transferencia"
    CARD = "card", "Tarjeta"
    OTHER = "other", "Otro"


class PaymentStatus(models.TextChoices):
    """Estado de la transacción individual.

    No incluye `partial`: un pago parcial de una cita es una propiedad
    *agregada* (`Appointment.payment_status`, ver `docs/erd.md`), resultado
    de sumar varios `Payment` — una transacción individual siempre está
    `pending`, `paid` o `refunded`, nunca "parcialmente" ella misma.
    """

    PENDING = "pending", "Pendiente"
    PAID = "paid", "Pagado"
    REFUNDED = "refunded", "Reembolsado"


class Payment(TenantAwareModel, TimeStampedModel):
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.PROTECT,
        related_name="payments",
        null=True,
        blank=True,
    )
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.01)])
    method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PAID)
    paid_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "customer", "status"]),
            models.Index(fields=["organization", "appointment", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.amount} · {self.method} · {self.status}"
