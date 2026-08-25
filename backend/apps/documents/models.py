from __future__ import annotations

from django.db import models

from core.models import TenantAwareModel, TimeStampedModel


class DocumentOwnerType(models.TextChoices):
    CUSTOMER = "customer", "Cliente"
    APPOINTMENT = "appointment", "Cita"
    CASE = "case", "Caso legal"
    WORK_ORDER = "work_order", "Orden de trabajo"
    PATIENT = "patient", "Paciente"
    ORDER = "order", "Pedido"


class DocumentStatus(models.TextChoices):
    ACTIVE = "active", "Activo"
    ARCHIVED = "archived", "Archivado"


def document_upload_path(instance: Document, filename: str) -> str:
    return f"documents/{instance.organization_id}/{instance.owner_type}/{instance.owner_id}/{filename}"


class Document(TenantAwareModel, TimeStampedModel):
    """Asociable a cualquier entidad de negocio vía `owner_type`/`owner_id`
    (docs/erd.md) en vez de una FK tipada, para no acoplar este modelo
    transversal a cada módulo. El control de acceso se resuelve en
    `core/owner_access.py`, según el tipo de propietario — "control de
    acceso desde el inicio" (requisito de la Fase 11B), no una capa
    agregada después.
    """

    owner_type = models.CharField(max_length=20, choices=DocumentOwnerType.choices)
    owner_id = models.UUIDField()
    name = models.CharField(max_length=255)
    # `upload_to` ya usa dos UUIDs (org + owner) en la ruta: con el
    # `max_length` por defecto (100), cualquier nombre de archivo real supera
    # el límite y `Storage.get_available_name()` nunca encuentra un nombre
    # disponible al desambiguar colisiones (`SuspiciousFileOperation`).
    file = models.FileField(upload_to=document_upload_path, max_length=500)
    file_type = models.CharField(max_length=100, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=DocumentStatus.choices, default=DocumentStatus.ACTIVE)
    uploaded_by_user = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, related_name="+", null=True, blank=True
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["organization", "owner_type", "owner_id"])]

    def __str__(self) -> str:
        return self.name
