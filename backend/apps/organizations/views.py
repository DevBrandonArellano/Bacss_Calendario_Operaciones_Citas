from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated

from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer
from core.permissions import HasPermission


class MyOrganizationView(RetrieveUpdateAPIView):
    """GET/PATCH de la organización del usuario autenticado (nunca por id libre)."""

    serializer_class = OrganizationSerializer

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT"):
            return [IsAuthenticated(), HasPermission("organizations:write")]
        return [IsAuthenticated()]

    def get_object(self) -> Organization:
        return self.request.user.organization
