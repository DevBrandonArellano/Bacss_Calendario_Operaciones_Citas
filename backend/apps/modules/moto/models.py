from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantAwareModel, TimeStampedModel


class Motorcycle(TenantAwareModel, TimeStampedModel):
    customer = models.ForeignKey("customers.Customer", on_delete=models.PROTECT, related_name="motorcycles")
    plate = models.CharField(max_length=20)
    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.PositiveIntegerField(null=True, blank=True)
    color = models.CharField(max_length=50, blank=True)
    vin = models.CharField(max_length=50, blank=True)
    engine_number = models.CharField(max_length=50, blank=True)
    mileage = models.PositiveIntegerField(default=0)
    purchase_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["plate"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "plate"], name="unique_motorcycle_plate_per_organization"
            )
        ]
        indexes = [models.Index(fields=["organization", "customer"])]

    def __str__(self) -> str:
        return f"{self.plate} · {self.brand} {self.model}"


class VehicleHistory(TenantAwareModel, TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.PROTECT, related_name="history")
    service_date = models.DateField()
    mileage = models.PositiveIntegerField()
    service_description = models.CharField(max_length=255)
    diagnosis = models.TextField(blank=True)
    parts_used = models.TextField(blank=True)
    labor_description = models.TextField(blank=True)
    technician = models.ForeignKey(
        "services.Employee",
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-service_date"]
        indexes = [models.Index(fields=["organization", "motorcycle"])]

    def __str__(self) -> str:
        return f"{self.motorcycle.plate} · {self.service_date} · {self.service_description}"


class WorkOrderStatus(models.TextChoices):
    RECEIVED = "received", "Recibida"
    DIAGNOSIS = "diagnosis", "En diagnóstico"
    AWAITING_AUTHORIZATION = "awaiting_authorization", "Esperando autorización"
    IN_REPAIR = "in_repair", "En reparación"
    AWAITING_PART = "awaiting_part", "Esperando repuesto"
    FINISHED = "finished", "Terminada"
    DELIVERED = "delivered", "Entregada"


VALID_WORK_ORDER_TRANSITIONS: dict[str, set[str]] = {
    WorkOrderStatus.RECEIVED: {WorkOrderStatus.DIAGNOSIS},
    WorkOrderStatus.DIAGNOSIS: {WorkOrderStatus.AWAITING_AUTHORIZATION},
    WorkOrderStatus.AWAITING_AUTHORIZATION: {WorkOrderStatus.IN_REPAIR},
    WorkOrderStatus.IN_REPAIR: {WorkOrderStatus.AWAITING_PART, WorkOrderStatus.FINISHED},
    WorkOrderStatus.AWAITING_PART: {WorkOrderStatus.IN_REPAIR},
    WorkOrderStatus.FINISHED: {WorkOrderStatus.DELIVERED},
    WorkOrderStatus.DELIVERED: set(),
}


class WorkOrder(TenantAwareModel, TimeStampedModel):
    motorcycle = models.ForeignKey(Motorcycle, on_delete=models.PROTECT, related_name="work_orders")
    appointment = models.ForeignKey(
        "appointments.Appointment",
        on_delete=models.SET_NULL,
        related_name="work_orders",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=30, choices=WorkOrderStatus.choices, default=WorkOrderStatus.RECEIVED
    )
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    diagnosis_notes = models.TextField(blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [models.Index(fields=["organization", "motorcycle", "status"])]

    def __str__(self) -> str:
        return f"OT {self.id} · {self.motorcycle.plate} · {self.status}"

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in VALID_WORK_ORDER_TRANSITIONS.get(self.status, set())


class WorkOrderItemType(models.TextChoices):
    PART = "part", "Repuesto"
    LABOR = "labor", "Mano de obra"


class WorkOrderItem(TenantAwareModel, TimeStampedModel):
    """No tiene `organization_id` en `docs/erd.md` (se documentó como tabla
    de detalle simple), pero hereda de `TenantAwareModel` igual que el
    resto de entidades de negocio: es la regla #1, no negociable, de
    `CLAUDE.md`, y `WorkOrderItem` — a diferencia de `SERVICE_BRANCH`/
    `EMPLOYEE_SERVICE`, que son tablas puente M2M — es una entidad de
    negocio con su propio ciclo de vida (líneas de una orden de trabajo).
    """

    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name="items")
    item_type = models.CharField(max_length=10, choices=WorkOrderItemType.choices)
    description = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, editable=False)

    class Meta:
        indexes = [models.Index(fields=["organization", "work_order"])]

    def __str__(self) -> str:
        return f"{self.description} × {self.quantity}"

    def save(self, *args, **kwargs):
        # Django no convierte `unit_price` a `Decimal` en la asignación
        # simple (solo al serializar para la DB), así que si llega como
        # `str` (p. ej. `.create(unit_price="5.50")`, un serializer, o
        # `seed_demo`), `unit_price * quantity` es repetición de string, no
        # multiplicación.
        self.subtotal = Decimal(self.unit_price) * self.quantity
        super().save(*args, **kwargs)
