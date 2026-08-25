import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.models import AuditAction, AuditLog
from apps.modules.laboratory.models import LabProcessStatus, LabResult, LabTest, Sample

pytestmark = pytest.mark.django_db


@pytest.fixture
def reception_client(api_client, organization, system_roles, make_user):
    user = make_user(organization, "recepcion@motorsecuador.test", roles=["reception"])
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


@pytest.fixture
def professional_client(organization, system_roles, make_user):
    # `docs/auth-rbac.md`: Admin empresa solo tiene "R" sobre `LabResult`;
    # únicamente el Profesional tiene "RU" (puede validar). `lab_results:write`
    # no está en los permisos de `org_admin` (`permissions_catalog.py`) a
    # propósito — es el mismo `auth_client` (org_admin) el que no puede
    # validar, no un bug de permisos.
    #
    # Usa su propia instancia de `APIClient` (no la fixture `api_client`
    # compartida): un test que combine `auth_client` y `professional_client`
    # necesita dos clientes autenticados como usuarios distintos al mismo
    # tiempo, no que el segundo sobreescriba las credenciales del primero.
    from rest_framework.test import APIClient

    client = APIClient()
    user = make_user(organization, "bioquimica@motorsecuador.test", roles=["professional"])
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


class TestModuloInactivo:
    def test_listar_pacientes_sin_modulo_activo_devuelve_404(self, auth_client):
        response = auth_client.get(reverse("patient-list"))
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestAccesoPorRol:
    def test_recepcion_no_tiene_acceso_al_modulo(self, reception_client, lab_active):
        response = reception_client.get(reverse("patient-list"))
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestPatientApi:
    def test_crea_un_paciente(self, auth_client, lab_active, organization):
        from apps.modules.laboratory.models import Patient

        response = auth_client.post(reverse("patient-list"), {"first_name": "Jorge", "last_name": "Paredes"})

        assert response.status_code == status.HTTP_201_CREATED
        created = Patient.all_objects.get(id=response.data["id"])
        assert created.organization_id == organization.id

    def test_aislamiento_por_tenant(self, auth_client, lab_active, other_organization):
        from apps.modules.laboratory.models import Patient

        Patient.all_objects.create(
            organization=other_organization, first_name="Otro", last_name="Paciente"
        )

        response = auth_client.get(reverse("patient-list"))

        assert response.status_code == status.HTTP_200_OK
        names = [item["first_name"] for item in response.data["results"]]
        assert "Otro" not in names


class TestLabOrderPipelineApi:
    def test_flujo_completo_via_api(
        self, auth_client, professional_client, lab_active, organization, patient, ordering_employee
    ):
        create_response = auth_client.post(
            reverse("lab-order-list"),
            {
                "patient_id": str(patient.id),
                "ordering_employee_id": str(ordering_employee.id),
                "tests": [{"test_code": "HEM001", "test_name": "Hemograma completo"}],
            },
            format="json",
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        lab_test_id = create_response.data["tests"][0]["id"]

        transition_response = auth_client.post(
            reverse("lab-test-transition", args=[lab_test_id]), {"status": "sample_pending"}
        )
        assert transition_response.status_code == status.HTTP_200_OK

        sample_response = auth_client.post(
            reverse("lab-test-collect-sample", args=[lab_test_id]), {"sample_type": "Sangre"}
        )
        assert sample_response.status_code == status.HTTP_200_OK
        assert Sample.all_objects.filter(lab_test_id=lab_test_id).exists()

        auth_client.post(reverse("lab-test-transition", args=[lab_test_id]), {"status": "processing"})

        result_response = auth_client.post(
            reverse("lab-test-record-result", args=[lab_test_id]),
            {"result_value": "12.5", "unit": "g/dL"},
        )
        assert result_response.status_code == status.HTTP_200_OK
        assert LabResult.all_objects.filter(lab_test_id=lab_test_id).exists()

        validate_response = professional_client.post(reverse("lab-test-validate", args=[lab_test_id]))
        assert validate_response.status_code == status.HTTP_200_OK
        assert validate_response.data["status"] == LabProcessStatus.VALIDATED

        lab_test = LabTest.all_objects.get(id=lab_test_id)
        assert lab_test.status == LabProcessStatus.VALIDATED

    def test_transicion_invalida_devuelve_409(self, auth_client, lab_active, lab_test):
        # lab_test está en ORDERED; "processing" es una opción válida del
        # serializer pero no un salto permitido desde ORDERED.
        response = auth_client.post(
            reverse("lab-test-transition", args=[lab_test.id]), {"status": "processing"}
        )
        assert response.status_code == status.HTTP_409_CONFLICT


class TestLabResultReadAudit:
    """docs/erd.md: 'todo acceso de lectura/escritura a LAB_RESULT queda auditado'."""

    @pytest.fixture
    def lab_result(self, organization, lab_test):
        return LabResult.all_objects.create(
            organization=organization, lab_test=lab_test, result_value="12.5", unit="g/dL"
        )

    def test_leer_un_resultado_individual_queda_auditado(self, auth_client, lab_active, lab_result):
        response = auth_client.get(reverse("lab-result-detail", args=[lab_result.id]))

        assert response.status_code == status.HTTP_200_OK
        entry = AuditLog.objects.get(
            action=AuditAction.READ, entity_type="LabResult", entity_id=str(lab_result.id)
        )
        assert entry.user_id is not None

    def test_listar_resultados_queda_auditado(self, auth_client, lab_active, lab_result):
        response = auth_client.get(reverse("lab-result-list"))

        assert response.status_code == status.HTTP_200_OK
        assert AuditLog.objects.filter(
            action=AuditAction.READ, entity_type="LabResult", entity_id=""
        ).exists()

    def test_lab_test_no_expone_valores_clinicos_sin_pasar_por_lab_results(
        self, auth_client, lab_active, lab_test, lab_result
    ):
        # El detalle de LabTest solo exige `laboratory:read`; el valor
        # clínico exige el permiso granular `lab_results:read` y su propio
        # endpoint auditado — no debe filtrarse aquí (docs/erd.md).
        response = auth_client.get(reverse("lab-test-detail", args=[lab_test.id]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["result"] == {"id": str(lab_result.id)}
        assert "result_value" not in response.data["result"]
