import pytest
from django.core import mail
from django.urls import reverse
from rest_framework import status

from apps.users.models import User

pytestmark = pytest.mark.django_db


def test_register_creates_organization_and_admin_user(api_client):
    payload = {
        "organization_name": "Motors Ecuador",
        "email": "admin@motorsecuador.test",
        "password": "SuperSegura123!",
    }

    response = api_client.post(reverse("auth-register"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    user = User.objects.get(email="admin@motorsecuador.test")
    assert user.organization.name == "Motors Ecuador"
    assert user.has_role("org_admin")


def test_register_rejects_duplicate_email(api_client, organization):
    User.objects.create_user(organization=organization, email="dup@test.com", password="Password123!")

    response = api_client.post(
        reverse("auth-register"),
        {"organization_name": "X", "email": "dup@test.com", "password": "SuperSegura123!"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_login_returns_access_and_refresh_tokens(api_client, organization):
    User.objects.create_user(organization=organization, email="user@test.com", password="Password123!")

    response = api_client.post(
        reverse("auth-login"), {"email": "user@test.com", "password": "Password123!"}, format="json"
    )

    assert response.status_code == status.HTTP_200_OK
    assert "access" in response.data
    assert "refresh" in response.data


def test_login_with_wrong_password_fails(api_client, organization):
    User.objects.create_user(organization=organization, email="user@test.com", password="Password123!")

    response = api_client.post(
        reverse("auth-login"), {"email": "user@test.com", "password": "wrong"}, format="json"
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout_blacklists_refresh_token(api_client, organization):
    User.objects.create_user(organization=organization, email="user@test.com", password="Password123!")
    login = api_client.post(
        reverse("auth-login"), {"email": "user@test.com", "password": "Password123!"}, format="json"
    )
    refresh = login.data["refresh"]

    logout_response = api_client.post(reverse("auth-logout"), {"refresh": refresh}, format="json")
    assert logout_response.status_code == status.HTTP_204_NO_CONTENT

    refresh_response = api_client.post(reverse("auth-token-refresh"), {"refresh": refresh}, format="json")
    assert refresh_response.status_code == status.HTTP_401_UNAUTHORIZED


def test_password_reset_flow(api_client, organization):
    user = User.objects.create_user(
        organization=organization, email="user@test.com", password="OldPassword123!"
    )

    request_response = api_client.post(reverse("auth-password-reset"), {"email": user.email}, format="json")
    assert request_response.status_code == status.HTTP_200_OK
    assert len(mail.outbox) == 1

    body = mail.outbox[0].body
    uid = body.split("uid=")[1].split("&token=")[0]
    token = body.split("&token=")[1].strip()

    confirm_response = api_client.post(
        reverse("auth-password-reset-confirm"),
        {"uid": uid, "token": token, "new_password": "NuevaPassword123!"},
        format="json",
    )
    assert confirm_response.status_code == status.HTTP_200_OK

    user.refresh_from_db()
    assert user.check_password("NuevaPassword123!")


def test_password_reset_request_does_not_reveal_unknown_email(api_client):
    response = api_client.post(reverse("auth-password-reset"), {"email": "nadie@test.com"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert len(mail.outbox) == 0
