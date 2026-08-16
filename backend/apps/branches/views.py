from rest_framework.viewsets import ModelViewSet

from apps.branches.models import Branch
from apps.branches.serializers import BranchSerializer
from core.permissions import HasPermission


class BranchViewSet(ModelViewSet):
    serializer_class = BranchSerializer
    queryset = Branch.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("branches:write")]
        return [HasPermission("branches:read")]

    def get_queryset(self):
        # El manager tenant-aware ya filtra por organización del contexto;
        # este get_queryset existe para dejar explícito el punto de entrada.
        return Branch.objects.all()
