from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q

from core.models import TenantAwareModel, TimeStampedModel


class NotificationChannel(models.TextChoices):
    EMAIL = "email", "Email"
    SMS = "sms", "SMS"
    WHATSAPP = "whatsapp", "WhatsApp"
    INTERNAL = "internal", "Interna"


class NotificationStatus(models.TextChoices):
    QUEUED = "queued", "En cola"
    SENT = "sent", "Enviada"
    FAILED = "failed", "Fallida"
    READ = "read", "Leída"


class NotificationTemplate(TimeStampedModel):
    """Plantilla de mensaje por evento de dominio y canal.

    No hereda de `TenantAwareModel`: `organization=None` define una
    plantilla global (fallback para toda organización que no tenga su
    propio override); una fila con `organization` específico la
    sobreescribe solo para esa empresa (docs/roadmap.md, Fase 6).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notification_templates",
        null=True,
        blank=True,
    )
    event_code = models.CharField(max_length=100)
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices)
    subject_template = models.CharField(max_length=255, blank=True)
    body_template = models.TextField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["event_code", "channel"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "event_code", "channel"],
                name="unique_template_per_org_event_channel",
            ),
            models.UniqueConstraint(
                fields=["event_code", "channel"],
                condition=Q(organization__isnull=True),
                name="unique_global_template_per_event_channel",
            ),
        ]

    def __str__(self) -> str:
        scope = self.organization.name if self.organization_id else "global"
        return f"{self.event_code} · {self.channel} · {scope}"


class NotificationSetting(TenantAwareModel, TimeStampedModel):
    """Configuración de notificaciones por organización (canales, recordatorios)."""

    reminder_offsets_hours = models.JSONField(default=list, blank=True)
    email_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    whatsapp_enabled = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization"], name="unique_notification_setting_per_organization"
            )
        ]

    def __str__(self) -> str:
        return f"Configuración de notificaciones · {self.organization_id}"


class Notification(TenantAwareModel, TimeStampedModel):
    """Registro de una notificación enviada/por enviar (docs/erd.md)."""

    recipient_user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices)
    event_code = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20, choices=NotificationStatus.choices, default=NotificationStatus.QUEUED
    )
    payload = models.JSONField(default=dict, blank=True)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "recipient_user", "status"]),
            models.Index(fields=["organization", "customer", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.event_code} · {self.channel} · {self.status}"
