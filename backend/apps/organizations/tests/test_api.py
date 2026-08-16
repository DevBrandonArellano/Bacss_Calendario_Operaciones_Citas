import pytest
from django.urls import reverse
from rest_framework import status

pytestmark = pytest.mark.django_db


def test_me_returns_only_own_organization(auth_client, organization, other_organization):
    response = auth_client.get(reverse("organization-me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == str(organization.id)
    assert response.data["id"] != str(other_organization.id)


def test_org_admin_can_update_own_organization(auth_client):
    response = auth_client.patch(reverse("organization-me"), {"name": "Motors Ecuador S.A."}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["name"] == "Motors Ecuador S.A."


def test_user_without_write_permission_cannot_update_organization(
    api_client, organization, make_user, system_roles
):
    from rest_framework_simplejwt.tokens import RefreshToken

    reception_user = make_user(organization, "recepcion@test.com", roles=["reception"])
    token = RefreshToken.for_user(reception_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    response = api_client.patch(reverse("organization-me"), {"name": "Hackeado"}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
