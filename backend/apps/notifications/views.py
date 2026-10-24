from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import mark_as_read
from core.permissions import HasPermission


class NotificationViewSet(RetrieveModelMixin, ListModelMixin, GenericViewSet):
    """Centro de notificaciones internas del usuario autenticado.

    Solo expone las notificaciones cuyo `recipient_user` es el usuario en
    sesión: el canal interno no es un buzón compartido de la organización.
    """

    serializer_class = NotificationSerializer
    permission_classes = [HasPermission("notifications:read")]

    def get_queryset(self):
        queryset = Notification.objects.filter(recipient_user=self.request.user)
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.filter(read_at__isnull=True)
        return queryset

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        mark_as_read(notification)
        return Response(NotificationSerializer(notification).data)
