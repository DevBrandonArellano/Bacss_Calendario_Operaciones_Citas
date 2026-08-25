import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.modules.legal.models import LegalCase
from apps.modules.moto.models import Motorcycle
from apps.organizations.models import ModuleActivation, ModuleCode
from apps.services.models import Employee

pytestmark = pytest.mark.django_db


@pytest.fixture
def reception_client(api_client, organization, system_roles, make_user):
    user = make_user(organization, "recepcion@motorsecuador.test", roles=["reception"])
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


class TestGlobalSearch:
    def test_query_muy_corta_devuelve_lista_vacia(self, auth_client):
        response = auth_client.get(reverse("global-search"), {"q": "a"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_encuentra_clientes_por_nombre(self, auth_client, organization):
        Customer.objects.all_objects.create(
            organization=organization, first_name="Valentina", last_name="Ruiz"
        )

        response = auth_client.get(reverse("global-search"), {"q": "Valentina"})

        assert response.status_code == status.HTTP_200_OK
        types = {item["type"] for item in response.data["results"]}
        assert "customer" in types

    def test_no_incluye_resultados_de_un_modulo_inactivo(self, auth_client, organization):
        # 'moto' no está activo para esta organización: no debe buscar Motorcycle.
        Motorcycle.objects.all_objects.create(
            organization=organization,
            customer=Customer.objects.all_objects.create(
                organization=organization, first_name="X", last_name="Y"
            ),
            plate="XYZMOTO",
            brand="XYZMOTO",
            model="XYZMOTO",
        )

        response = auth_client.get(reverse("global-search"), {"q": "XYZMOTO"})

        types = {item["type"] for item in response.data["results"]}
        assert "motorcycle" not in types

    def test_incluye_motos_cuando_el_modulo_esta_activo(self, auth_client, organization):
        ModuleActivation.objects.create(organization=organization, module_code=ModuleCode.MOTO)
        customer = Customer.objects.all_objects.create(
            organization=organization, first_name="X", last_name="Y"
        )
        Motorcycle.objects.all_objects.create(
            organization=organization, customer=customer, plate="ABCMOTO", brand="Yamaha", model="FZ"
        )

        response = auth_client.get(reverse("global-search"), {"q": "ABCMOTO"})

        types = {item["type"] for item in response.data["results"]}
        assert "motorcycle" in types

    def test_recepcion_no_ve_casos_legales_sin_permiso(self, reception_client, organization):
        ModuleActivation.objects.create(organization=organization, module_code=ModuleCode.LEGAL)
        branch = Branch.objects.all_objects.create(organization=organization, name="Sede")
        customer = Customer.objects.all_objects.create(
            organization=organization, first_name="X", last_name="Y"
        )
        lawyer = Employee.objects.all_objects.create(
            organization=organization, branch=branch, first_name="A", last_name="B"
        )
        LegalCase.objects.all_objects.create(
            organization=organization,
            case_number="LEGSEARCH1",
            customer=customer,
            case_type="Civil",
            responsible_lawyer=lawyer,
        )

        response = reception_client.get(reverse("global-search"), {"q": "LEGSEARCH1"})

        types = {item["type"] for item in response.data["results"]}
        assert "legal_case" not in types

    def test_no_devuelve_resultados_de_otra_organizacion(self, auth_client, organization, other_organization):
        Customer.objects.all_objects.create(
            organization=other_organization, first_name="Ajenisimo", last_name="Otro"
        )

        response = auth_client.get(reverse("global-search"), {"q": "Ajenisimo"})

        assert response.data["results"] == []
