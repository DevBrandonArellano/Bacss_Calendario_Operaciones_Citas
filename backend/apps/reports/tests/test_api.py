import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

pytestmark = pytest.mark.django_db


@pytest.fixture
def reception_client(api_client, organization, system_roles, make_user):
    user = make_user(organization, "recepcion@motorsecuador.test", roles=["reception"])
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


class TestDashboardApi:
    def test_admin_ve_dashboard_con_cifras_financieras(self, auth_client):
        response = auth_client.get(reverse("reports-dashboard"))
        assert response.status_code == status.HTTP_200_OK
        assert "revenue_this_month" in response.data

    def test_recepcion_ve_dashboard_sin_cifras_financieras(self, reception_client):
        response = reception_client.get(reverse("reports-dashboard"))
        assert response.status_code == status.HTTP_200_OK
        assert "revenue_this_month" not in response.data


class TestChartsApi:
    def test_metric_invalida_devuelve_400(self, auth_client):
        response = auth_client.get(reverse("reports-charts"), {"metric": "no-existe"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestModuleReportApi:
    def test_modulo_inactivo_devuelve_404(self, auth_client):
        response = auth_client.get(reverse("reports-module", args=["legal"]))
        assert response.status_code == status.HTTP_404_NOT_FOUND
