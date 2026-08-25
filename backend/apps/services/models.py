from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantAwareModel, TimeStampedModel


class ServiceStatus(models.TextChoices):
    ACTIVE = "active", "Activo"
    INACTIVE = "inactive", "Inactivo"


class Service(TenantAwareModel, TimeStampedModel):
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=100, blank=True)
    duration_minutes = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    status = models.CharField(max_length=20, choices=ServiceStatus.choices, default=ServiceStatus.ACTIVE)
    branches = models.ManyToManyField("branches.Branch", related_name="services", blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "name"], name="unique_service_name_per_org")
        ]

    def __str__(self) -> str:
        return self.name


class Employee(TenantAwareModel, TimeStampedModel):
    user = models.OneToOneField(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="employee_profile",
        null=True,
        blank=True,
        help_text="null si el empleado aún no tiene una cuenta de acceso propia.",
    )
    branch = models.ForeignKey(
        "branches.Branch", on_delete=models.SET_NULL, related_name="employees", null=True, blank=True
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    specialty = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    services = models.ManyToManyField(Service, related_name="employees", blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self) -> str:
        return self.full_name

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
