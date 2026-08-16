from django.db import models

from core.models import TenantAwareModel, TimeStampedModel


class Branch(TenantAwareModel, TimeStampedModel):
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    timezone_override = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["organization", "name"], name="unique_branch_name_per_org")
        ]

    def __str__(self) -> str:
        return self.name
