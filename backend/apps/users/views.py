from django.db.models import Q
from rest_framework.generics import ListAPIView
from rest_framework.viewsets import ModelViewSet

from apps.users.models import Role, User
from apps.users.serializers import RoleSerializer, UserCreateSerializer, UserSerializer
from core.permissions import HasPermission


class UserViewSet(ModelViewSet):
    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("users:write")]
        return [HasPermission("users:read")]

    def get_queryset(self):
        organization = self.request.user.organization
        return User.objects.filter(organization=organization).prefetch_related("roles")


class RoleListView(ListAPIView):
    serializer_class = RoleSerializer
    permission_classes = [HasPermission("users:read")]

    def get_queryset(self):
        organization = self.request.user.organization
        return Role.objects.filter(Q(organization=organization) | Q(is_system_role=True))
