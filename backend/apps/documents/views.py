from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import CreateModelMixin, DestroyModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.documents.models import Document
from apps.documents.serializers import DocumentSerializer, UploadDocumentSerializer
from apps.documents.services import UploadDocumentRequest, UploadDocumentUseCase
from core import exceptions as domain_exceptions
from core.owner_access import check_owner_permission


class DocumentViewSet(
    CreateModelMixin, RetrieveModelMixin, ListModelMixin, DestroyModelMixin, GenericViewSet
):
    """Sin `ModuleActiveRequired`: el control de acceso real depende del
    tipo de propietario (`core/owner_access.py`), no de un módulo fijo —
    `Document` es transversal (docs/roadmap.md, Fase 11B)."""

    serializer_class = DocumentSerializer
    queryset = Document.objects.all()
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        if self.action == "list":
            owner_type = self.request.query_params.get("owner_type")
            owner_id = self.request.query_params.get("owner_id")
            if not owner_type or not owner_id:
                raise domain_exceptions.ValidationError(
                    "Debes indicar 'owner_type' y 'owner_id' para listar documentos."
                )
            check_owner_permission(self.request.user, owner_type, owner_id, write=False)
            return Document.objects.filter(owner_type=owner_type, owner_id=owner_id)
        return Document.objects.all()

    def create(self, request, *args, **kwargs):
        payload = UploadDocumentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = UploadDocumentUseCase(organization=request.user.organization, actor_user=request.user)
        document = use_case.execute(
            UploadDocumentRequest(
                owner_type=data["owner_type"],
                owner_id=str(data["owner_id"]),
                name=data["name"],
                file=data["file"],
            )
        )
        return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        check_owner_permission(request.user, instance.owner_type, instance.owner_id, write=False)
        return Response(DocumentSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        check_owner_permission(request.user, instance.owner_type, instance.owner_id, write=True)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        """Registro de descargas en auditoría (requisito explícito de la
        Fase 11B, distinto de la auditoría de creación/borrado)."""

        instance = self.get_object()
        check_owner_permission(request.user, instance.owner_type, instance.owner_id, write=False)

        from apps.audit.models import AuditAction
        from apps.audit.services import log_action

        log_action(
            action=AuditAction.DOWNLOAD,
            entity_type="Document",
            entity_id=str(instance.id),
            organization=instance.organization,
            user=request.user,
            changes={"name": instance.name},
        )
        return FileResponse(instance.file.open("rb"), as_attachment=True, filename=instance.name)
