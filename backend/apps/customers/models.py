from django.db import models
from django.db.models import Q

from core.models import TenantAwareModel, TimeStampedModel


class CustomerStatus(models.TextChoices):
    ACTIVE = "active", "Activo"
    INACTIVE = "inactive", "Inactivo"


class Customer(TenantAwareModel, TimeStampedModel):
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.SET_NULL,
        related_name="customers",
        null=True,
        blank=True,
    )
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    document_type = models.CharField(max_length=30, blank=True)
    document_number = models.CharField(max_length=50, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=CustomerStatus.choices, default=CustomerStatus.ACTIVE)
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "document_number"],
                condition=~Q(document_number=""),
                name="unique_customer_document_per_organization",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "last_name", "first_name"]),
        ]

    def __str__(self) -> str:
        return self.full_name

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
