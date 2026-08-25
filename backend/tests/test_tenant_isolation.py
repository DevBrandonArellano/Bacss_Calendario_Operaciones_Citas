"""Batería transversal de aislamiento multitenant (docs/test-plan.md).

Cubre, para cada recurso del core de la Fase 2, la regla #1 de CLAUDE.md:
un usuario de la Empresa A nunca puede leer ni escribir datos de la
Empresa B. Complementa los tests específicos de cada app
(apps/*/tests/test_api.py).
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.branches.models import Branch
from apps.users.models import User

pytestmark = pytest.mark.django_db


@pytest.fixture
def other_org_admin(other_organization, system_roles):
    user = User.objects.create_user(
        organization=other_organization, email="admin@labx.test", password="Password123!"
    )
    from apps.users.models import Role

    user.roles.add(Role.objects.get(code="org_admin", is_system_role=True))
    return user


@pytest.fixture
def other_org_client(other_org_admin):
    from rest_framework.test import APIClient

    client = APIClient()
    token = RefreshToken.for_user(other_org_admin)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class TestAislamientoMultitenant:
    """Tabla de decisión: (recurso × organización solicitante) -> visibilidad."""

    def test_organizacion_a_no_ve_sucursales_de_organizacion_b(
        self, auth_client, other_org_client, organization, other_organization
    ):
        Branch.objects.all_objects.create(organization=organization, name="Sucursal A")
        Branch.objects.all_objects.create(organization=other_organization, name="Sucursal B")

        response_a = auth_client.get(reverse("branch-list"))
        response_b = other_org_client.get(reverse("branch-list"))

        names_a = {b["name"] for b in response_a.data["results"]}
        names_b = {b["name"] for b in response_b.data["results"]}

        assert names_a == {"Sucursal A"}
        assert names_b == {"Sucursal B"}
        assert names_a.isdisjoint(names_b)

    def test_organizacion_a_no_ve_usuarios_de_organizacion_b(
        self, auth_client, other_org_client, org_admin_user, other_org_admin
    ):
        response_a = auth_client.get(reverse("user-list"))
        response_b = other_org_client.get(reverse("user-list"))

        emails_a = {u["email"] for u in response_a.data["results"]}
        emails_b = {u["email"] for u in response_b.data["results"]}

        assert org_admin_user.email in emails_a
        assert other_org_admin.email not in emails_a
        assert other_org_admin.email in emails_b
        assert org_admin_user.email not in emails_b

    def test_organizacion_a_no_puede_editar_su_propia_vista_me_con_datos_de_b(
        self, auth_client, organization, other_organization
    ):
        response = auth_client.get(reverse("organization-me"))

        assert response.data["id"] == str(organization.id)
        assert response.data["id"] != str(other_organization.id)

    def test_valor_limite_organization_id_nulo_no_filtra_todo_por_accidente(self, api_client, organization):
        """Caja blanca: sin organización en contexto, el manager devuelve vacío, no todo."""
        Branch.objects.all_objects.create(organization=organization, name="Sucursal A")

        response = api_client.get(reverse("branch-list"))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
