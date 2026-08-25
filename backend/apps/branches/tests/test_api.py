import pytest
from django.urls import reverse
from rest_framework import status

from apps.branches.models import Branch

pytestmark = pytest.mark.django_db


def test_create_branch_assigns_organization_from_authenticated_user(auth_client, organization):
    url = reverse("branch-list")

    response = auth_client.post(url, {"name": "Sucursal Norte"}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    branch = Branch.all_objects.get(id=response.data["id"])
    assert branch.organization_id == organization.id


def test_create_branch_ignores_organization_id_sent_in_body(auth_client, organization, other_organization):
    url = reverse("branch-list")

    response = auth_client.post(
        url, {"name": "Sucursal Sur", "organization": str(other_organization.id)}, format="json"
    )

    assert response.status_code == status.HTTP_201_CREATED
    branch = Branch.all_objects.get(id=response.data["id"])
    assert branch.organization_id == organization.id  # nunca el de other_organization


def test_list_branches_never_returns_other_organization_data(auth_client, organization, other_organization):
    Branch.all_objects.create(organization=organization, name="Sucursal propia")
    Branch.all_objects.create(organization=other_organization, name="Sucursal ajena")

    response = auth_client.get(reverse("branch-list"))

    names = [b["name"] for b in response.data["results"]]
    assert names == ["Sucursal propia"]


def test_retrieve_branch_of_other_organization_returns_404_not_403(auth_client, other_organization):
    foreign_branch = Branch.all_objects.create(organization=other_organization, name="Ajena")

    response = auth_client.get(reverse("branch-detail", args=[foreign_branch.id]))

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_branch_endpoints_require_authentication(api_client):
    response = api_client.get(reverse("branch-list"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_user_without_write_permission_cannot_create_branch(
    api_client, organization, make_user, system_roles
):
    from rest_framework_simplejwt.tokens import RefreshToken

    reception_user = make_user(organization, "recepcion@test.com", roles=["reception"])
    token = RefreshToken.for_user(reception_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    response = api_client.post(reverse("branch-list"), {"name": "Sucursal Norte"}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
