from rest_framework.generics import ListAPIView

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from core.permissions import HasPermission


class AuditLogListView(ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [HasPermission("audit:read")]

    def get_queryset(self):
        organization = self.request.user.organization
        return AuditLog.objects.filter(organization=organization)
