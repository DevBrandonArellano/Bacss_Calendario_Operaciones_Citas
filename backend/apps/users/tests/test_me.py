import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

pytestmark = pytest.mark.django_db


def test_me_devuelve_perfil_y_permisos_efectivos(auth_client, org_admin_user):
    response = auth_client.get(reverse("user-me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["email"] == org_admin_user.email
    assert "appointments:write" in response.data["permissions"]


def test_me_refleja_los_permisos_reales_del_rol(api_client, organization, make_user, system_roles):
    reception = make_user(organization, "recepcion@test.com", roles=["reception"])
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(reception).access_token}")

    response = api_client.get(reverse("user-me"))

    assert response.status_code == status.HTTP_200_OK
    assert "appointments:write" in response.data["permissions"]
    assert "users:write" not in response.data["permissions"]
    assert "laboratory:read" not in response.data["permissions"]


def test_me_requiere_autenticacion(api_client):
    response = api_client.get(reverse("user-me"))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_me_no_expone_datos_de_otro_usuario(
    auth_client, organization, other_organization, make_user, system_roles
):
    make_user(other_organization, "ajeno@test.com", roles=["org_admin"])

    response = auth_client.get(reverse("user-me"))

    assert response.data["email"] != "ajeno@test.com"
