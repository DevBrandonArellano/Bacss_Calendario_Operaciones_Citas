import pytest
from django.urls import reverse
from rest_framework import status

from apps.users.models import User

pytestmark = pytest.mark.django_db


def test_list_users_never_returns_other_organization_users(
    auth_client, organization, other_organization, org_admin_user
):
    User.objects.create_user(organization=other_organization, email="ajeno@test.com", password="Password123!")

    response = auth_client.get(reverse("user-list"))

    emails = [u["email"] for u in response.data["results"]]
    assert "ajeno@test.com" not in emails
    assert org_admin_user.email in emails


def test_create_user_assigns_requested_system_role(auth_client, system_roles):
    url = reverse("user-list")
    payload = {
        "email": "nueva-recepcion@test.com",
        "password": "Password123!",
        "role_codes": ["reception"],
    }

    response = auth_client.post(url, payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    user = User.objects.get(email="nueva-recepcion@test.com")
    assert user.has_role("reception")


def test_reception_user_cannot_create_other_users(api_client, organization, make_user, system_roles):
    from rest_framework_simplejwt.tokens import RefreshToken

    reception_user = make_user(organization, "recepcion@test.com", roles=["reception"])
    token = RefreshToken.for_user(reception_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    response = api_client.post(
        reverse("user-list"), {"email": "otro@test.com", "password": "Password123!"}, format="json"
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
