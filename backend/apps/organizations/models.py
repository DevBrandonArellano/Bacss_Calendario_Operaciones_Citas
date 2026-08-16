from __future__ import annotations

import uuid

from django.db import models

from core.models import TimeStampedModel


class ModuleCode(models.TextChoices):
    MOTO = "moto", "Taller de motos"
    LABORATORY = "laboratory", "Laboratorio clínico"
    STORE = "store", "Tienda / lanzamientos"
    LEGAL = "legal", "Legal"


class OrganizationStatus(models.TextChoices):
    TRIAL = "trial", "Prueba"
    ACTIVE = "active", "Activa"
    SUSPENDED = "suspended", "Suspendida"


class Organization(TimeStampedModel):
    """La organización ES el tenant; no hereda de TenantAwareModel (ADR-001)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    legal_name = models.CharField(max_length=200, blank=True)
    tax_id = models.CharField(max_length=50, blank=True)
    timezone = models.CharField(max_length=64, default="America/Guayaquil")
    default_currency = models.CharField(max_length=3, default="USD")
    date_format = models.CharField(max_length=20, default="DD/MM/YYYY")
    logo_url = models.URLField(blank=True)
    status = models.CharField(
        max_length=20, choices=OrganizationStatus.choices, default=OrganizationStatus.TRIAL
    )
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def has_module_active(self, module_code: str) -> bool:
        return self.module_activations.filter(module_code=module_code, is_active=True).exists()


class ModuleActivation(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="module_activations"
    )
    module_code = models.CharField(max_length=30, choices=ModuleCode.choices)
    is_active = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)
    activated_at = models.DateTimeField(auto_now_add=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "module_code"], name="unique_module_per_organization"
            )
        ]

    def __str__(self) -> str:
        return f"{self.organization.name} · {self.get_module_code_display()}"
