import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.modules.legal.models import LegalCase
from apps.services.models import Employee

pytestmark = pytest.mark.django_db


@pytest.fixture
def reception_client(api_client, organization, system_roles, make_user):
    user = make_user(organization, "recepcion@motorsecuador.test", roles=["reception"])
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


@pytest.fixture
def professional_user_and_employee(organization, branch, system_roles, make_user):
    user = make_user(organization, "abogado2@motorsecuador.test", roles=["professional"])
    employee = Employee.objects.all_objects.create(
        organization=organization, branch=branch, user=user, first_name="Lucía", last_name="Litigante"
    )
    return user, employee


@pytest.fixture
def professional_client(api_client, professional_user_and_employee):
    user, _employee = professional_user_and_employee
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


class TestModuloInactivo:
    def test_listar_casos_sin_modulo_activo_devuelve_404(self, auth_client):
        response = auth_client.get(reverse("legal-case-list"))
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestAccesoPorRol:
    def test_recepcion_no_tiene_acceso_al_modulo(self, reception_client, legal_active):
        response = reception_client.get(reverse("legal-case-list"))
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestAlcanceSobreCasosPropios:
    def test_profesional_sin_read_all_solo_ve_sus_casos_asignados(
        self, professional_client, legal_active, organization, customer, lawyer, professional_user_and_employee
    ):
        _user, own_employee = professional_user_and_employee
        LegalCase.objects.all_objects.create(
            organization=organization,
            case_number="CASE-AJENO",
            customer=customer,
            case_type="Civil",
            responsible_lawyer=lawyer,  # otro abogado, no el usuario autenticado
        )
        LegalCase.objects.all_objects.create(
            organization=organization,
            case_number="CASE-PROPIO",
            customer=customer,
            case_type="Civil",
            responsible_lawyer=own_employee,
        )

        response = professional_client.get(reverse("legal-case-list"))

        assert response.status_code == status.HTTP_200_OK
        case_numbers = [item["case_number"] for item in response.data["results"]]
        assert case_numbers == ["CASE-PROPIO"]

    def test_admin_con_read_all_ve_todos_los_casos(
        self, auth_client, legal_active, organization, customer, lawyer, professional_user_and_employee
    ):
        _user, own_employee = professional_user_and_employee
        LegalCase.objects.all_objects.create(
            organization=organization,
            case_number="CASE-A",
            customer=customer,
            case_type="Civil",
            responsible_lawyer=lawyer,
        )
        LegalCase.objects.all_objects.create(
            organization=organization,
            case_number="CASE-B",
            customer=customer,
            case_type="Civil",
            responsible_lawyer=own_employee,
        )

        response = auth_client.get(reverse("legal-case-list"))

        assert response.status_code == status.HTTP_200_OK
        case_numbers = {item["case_number"] for item in response.data["results"]}
        assert case_numbers == {"CASE-A", "CASE-B"}


class TestLegalCaseApi:
    def test_aislamiento_por_tenant(self, auth_client, legal_active, other_organization):
        from apps.customers.models import Customer

        other_customer = Customer.objects.all_objects.create(
            organization=other_organization, first_name="Ajeno", last_name="Ajeno"
        )
        other_lawyer = Employee.objects.all_objects.create(
            organization=other_organization, first_name="Otro", last_name="Abogado"
        )
        LegalCase.objects.all_objects.create(
            organization=other_organization,
            case_number="CASE-OTRA-ORG",
            customer=other_customer,
            case_type="Civil",
            responsible_lawyer=other_lawyer,
        )

        response = auth_client.get(reverse("legal-case-list"))

        assert response.status_code == status.HTTP_200_OK
        case_numbers = [item["case_number"] for item in response.data["results"]]
        assert "CASE-OTRA-ORG" not in case_numbers

    def test_flujo_completo_via_api(self, auth_client, legal_active, customer, lawyer):
        create_response = auth_client.post(
            reverse("legal-case-list"),
            {
                "case_number": "CASE-200",
                "customer_id": str(customer.id),
                "case_type": "Civil",
                "responsible_lawyer_id": str(lawyer.id),
            },
            format="json",
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        case_id = create_response.data["id"]

        transition_response = auth_client.post(
            reverse("legal-case-transition", args=[case_id]), {"status": "in_review"}
        )
        assert transition_response.status_code == status.HTTP_200_OK
        assert transition_response.data["status"] == "in_review"

        event_response = auth_client.post(
            reverse("legal-case-events", args=[case_id]),
            {"event_type": "note", "description": "Llamada con el cliente."},
        )
        assert event_response.status_code == status.HTTP_201_CREATED

        events_list = auth_client.get(reverse("legal-case-events", args=[case_id]))
        assert events_list.status_code == status.HTTP_200_OK
        # 1 evento automático de apertura + 1 de transición + 1 manual = 3.
        assert events_list.data["count"] == 3

    def test_transicion_invalida_devuelve_409(self, auth_client, legal_active, legal_case):
        response = auth_client.post(reverse("legal-case-transition", args=[legal_case.id]), {"status": "archived"})
        assert response.status_code == status.HTTP_409_CONFLICT


class TestHearingAndCaseTaskScoping:
    def test_profesional_no_ve_audiencias_de_casos_ajenos(
        self, professional_client, legal_active, organization, legal_case
    ):
        from apps.modules.legal.models import Hearing

        Hearing.objects.all_objects.create(
            organization=organization, legal_case=legal_case, scheduled_at="2026-09-01T10:00:00Z"
        )

        response = professional_client.get(reverse("hearing-list"))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []
