from __future__ import annotations

from django.db import models
from django.db.models import Q

from core.models import TenantAwareModel, TimeStampedModel


class PatientSex(models.TextChoices):
    FEMALE = "female", "Femenino"
    MALE = "male", "Masculino"
    OTHER = "other", "Otro"


class Patient(TenantAwareModel, TimeStampedModel):
    """Datos sensibles: control de acceso reforzado (docs/erd.md,
    docs/security-iso27001.md). `customer` es opcional: no todo paciente
    de laboratorio es necesariamente un `Customer` del core."""

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        related_name="patients",
        null=True,
        blank=True,
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    document_number = models.CharField(max_length=50, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=10, choices=PatientSex.choices, blank=True)
    medical_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "document_number"],
                condition=~Q(document_number=""),
                name="unique_patient_document_per_organization",
            )
        ]

    def __str__(self) -> str:
        return self.full_name

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


# Las 7 etapas del proceso, compartidas por LabOrder (agregado) y LabTest
# (por prueba individual) — ver docs/erd.md.
class LabProcessStatus(models.TextChoices):
    ORDERED = "ordered", "Solicitada"
    SAMPLE_PENDING = "sample_pending", "Esperando toma de muestra"
    SAMPLE_TAKEN = "sample_taken", "Muestra tomada"
    PROCESSING = "processing", "En procesamiento"
    RESULT_AVAILABLE = "result_available", "Resultado disponible"
    VALIDATED = "validated", "Validado"
    DELIVERED = "delivered", "Entregado"


# Orden lineal de las etapas, usado para calcular el estado agregado del
# pedido (el cuello de botella: la prueba menos avanzada) y para validar
# transiciones de un solo paso hacia adelante.
LAB_PROCESS_STAGE_ORDER: list[str] = [
    LabProcessStatus.ORDERED,
    LabProcessStatus.SAMPLE_PENDING,
    LabProcessStatus.SAMPLE_TAKEN,
    LabProcessStatus.PROCESSING,
    LabProcessStatus.RESULT_AVAILABLE,
    LabProcessStatus.VALIDATED,
    LabProcessStatus.DELIVERED,
]

VALID_LAB_TEST_TRANSITIONS: dict[str, set[str]] = {
    stage: ({LAB_PROCESS_STAGE_ORDER[i + 1]} if i + 1 < len(LAB_PROCESS_STAGE_ORDER) else set())
    for i, stage in enumerate(LAB_PROCESS_STAGE_ORDER)
}


class LabOrder(TenantAwareModel, TimeStampedModel):
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="lab_orders")
    ordering_employee = models.ForeignKey(
        "services.Employee",
        on_delete=models.PROTECT,
        related_name="ordered_lab_orders",
    )
    status = models.CharField(
        max_length=20, choices=LabProcessStatus.choices, default=LabProcessStatus.ORDERED
    )
    ordered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-ordered_at"]
        indexes = [models.Index(fields=["organization", "patient", "status"])]

    def __str__(self) -> str:
        return f"Pedido {self.id} · {self.patient.full_name}"


class LabTest(TenantAwareModel, TimeStampedModel):
    lab_order = models.ForeignKey(LabOrder, on_delete=models.CASCADE, related_name="tests")
    test_code = models.CharField(max_length=50)
    test_name = models.CharField(max_length=150)
    status = models.CharField(
        max_length=20, choices=LabProcessStatus.choices, default=LabProcessStatus.ORDERED
    )

    class Meta:
        indexes = [models.Index(fields=["organization", "lab_order", "status"])]

    def __str__(self) -> str:
        return f"{self.test_name} · {self.status}"

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in VALID_LAB_TEST_TRANSITIONS.get(self.status, set())


class SampleStatus(models.TextChoices):
    PENDING = "pending", "Pendiente"
    COLLECTED = "collected", "Recolectada"
    REJECTED = "rejected", "Rechazada"


class Sample(TenantAwareModel, TimeStampedModel):
    lab_test = models.OneToOneField(LabTest, on_delete=models.CASCADE, related_name="sample")
    sample_type = models.CharField(max_length=50)
    collected_at = models.DateTimeField(null=True, blank=True)
    collected_by_employee = models.ForeignKey(
        "services.Employee",
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    status = models.CharField(max_length=20, choices=SampleStatus.choices, default=SampleStatus.PENDING)

    def __str__(self) -> str:
        return f"Muestra {self.sample_type} · {self.status}"


class LabResult(TenantAwareModel, TimeStampedModel):
    """Dato clínico sensible: nunca se registra en logs operacionales
    (docs/logging.md), todo acceso queda auditado (docs/erd.md)."""

    lab_test = models.OneToOneField(LabTest, on_delete=models.CASCADE, related_name="result")
    result_value = models.CharField(max_length=255)
    unit = models.CharField(max_length=30, blank=True)
    reference_range = models.CharField(max_length=100, blank=True)
    observations = models.TextField(blank=True)
    validated_by_employee = models.ForeignKey(
        "services.Employee",
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
    )
    validated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Resultado {self.lab_test.test_name}"
