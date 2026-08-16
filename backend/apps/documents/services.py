"""Caso de uso de subida de documentos (docs/roadmap.md, Fase 11B)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from apps.documents.models import Document
from core.context import tenant_scope
from core.owner_access import check_owner_permission


@dataclass(frozen=True)
class UploadDocumentRequest:
    owner_type: str
    owner_id: str
    name: str
    file: Any


class UploadDocumentUseCase:
    def __init__(self, *, organization, actor_user):
        self.organization = organization
        self.actor_user = actor_user

    def execute(self, request: UploadDocumentRequest) -> Document:
        with tenant_scope(self.organization.id):
            return self._execute(request)

    def _execute(self, request: UploadDocumentRequest) -> Document:
        from apps.audit.models import AuditAction
        from apps.audit.services import log_action

        check_owner_permission(self.actor_user, request.owner_type, request.owner_id, write=True)

        document = Document.objects.create(
            organization=self.organization,
            owner_type=request.owner_type,
            owner_id=request.owner_id,
            name=request.name,
            file=request.file,
            file_type=getattr(request.file, "content_type", "") or "",
            size_bytes=request.file.size,
            uploaded_by_user=self.actor_user,
        )
        log_action(
            action=AuditAction.CREATE,
            entity_type="Document",
            entity_id=str(document.id),
            organization=self.organization,
            user=self.actor_user,
            changes={"name": document.name, "owner_type": document.owner_type},
        )
        return document
