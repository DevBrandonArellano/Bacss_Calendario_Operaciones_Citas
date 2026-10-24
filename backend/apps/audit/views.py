from rest_framework.generics import ListAPIView

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from core.permissions import HasPermission


class AuditLogListView(ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [HasPermission("audit:read")]

    def get_queryset(self):
        # AuditLog.objects ya filtra por la organización del contexto actual
        # (apps/audit/models.py, AuditLogManager) — igual que el resto de
        # modelos tenant-aware, no hace falta filtrar a mano aquí.
        return AuditLog.objects.all()
