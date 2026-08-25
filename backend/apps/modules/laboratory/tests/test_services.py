import pytest

from apps.modules.laboratory.models import LabOrder, LabProcessStatus, LabTest
from apps.modules.laboratory.services import (
    CollectSampleRequest,
    CollectSampleUseCase,
    CreateLabOrderRequest,
    CreateLabOrderUseCase,
    LabTestSpec,
    RecordLabResultRequest,
    RecordLabResultUseCase,
    TransitionLabTestUseCase,
    ValidateLabResultUseCase,
)
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


class TestCreateLabOrder:
    def test_crea_pedido_con_pruebas(self, organization, patient, ordering_employee):
        use_case = CreateLabOrderUseCase(organization=organization)
        lab_order = use_case.execute(
            CreateLabOrderRequest(
                patient_id=str(patient.id),
                ordering_employee_id=str(ordering_employee.id),
                tests=[LabTestSpec(test_code="HEM001", test_name="Hemograma")],
            )
        )

        assert lab_order.status == LabProcessStatus.ORDERED
        assert LabTest.all_objects.filter(lab_order=lab_order).count() == 1

    def test_sin_pruebas_lanza_validation_error(self, organization, patient, ordering_employee):
        use_case = CreateLabOrderUseCase(organization=organization)
        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                CreateLabOrderRequest(
                    patient_id=str(patient.id), ordering_employee_id=str(ordering_employee.id), tests=[]
                )
            )

    def test_paciente_inexistente_lanza_not_found(self, organization, ordering_employee):
        use_case = CreateLabOrderUseCase(organization=organization)
        with pytest.raises(domain_exceptions.NotFoundError):
            use_case.execute(
                CreateLabOrderRequest(
                    patient_id="00000000-0000-0000-0000-000000000000",
                    ordering_employee_id=str(ordering_employee.id),
                    tests=[LabTestSpec(test_code="X", test_name="Y")],
                )
            )


class TestLabOrderStatusAggregation:
    def test_estado_del_pedido_es_el_cuello_de_botella(self, organization, lab_order):
        advanced = LabTest.all_objects.create(
            organization=organization,
            lab_order=lab_order,
            test_code="A",
            test_name="A",
            status=LabProcessStatus.PROCESSING,
        )
        behind = LabTest.all_objects.create(
            organization=organization,
            lab_order=lab_order,
            test_code="B",
            test_name="B",
            status=LabProcessStatus.ORDERED,
        )

        TransitionLabTestUseCase().execute(advanced, LabProcessStatus.RESULT_AVAILABLE)

        lab_order.refresh_from_db()
        # 'advanced' avanzó, pero 'behind' sigue en ORDERED: el pedido
        # refleja el cuello de botella, no la prueba más avanzada.
        assert lab_order.status == LabProcessStatus.ORDERED
        assert behind.status == LabProcessStatus.ORDERED


class TestFullPipeline:
    def test_flujo_completo_hasta_validado(self, organization, lab_test):
        transition = TransitionLabTestUseCase()
        transition.execute(lab_test, LabProcessStatus.SAMPLE_PENDING)

        CollectSampleUseCase().execute(lab_test, CollectSampleRequest(sample_type="Sangre"))
        lab_test.refresh_from_db()
        assert lab_test.status == LabProcessStatus.SAMPLE_TAKEN
        assert lab_test.sample.status == "collected"

        transition.execute(lab_test, LabProcessStatus.PROCESSING)

        RecordLabResultUseCase().execute(lab_test, RecordLabResultRequest(result_value="12.5", unit="g/dL"))
        lab_test.refresh_from_db()
        assert lab_test.status == LabProcessStatus.RESULT_AVAILABLE
        assert lab_test.result.result_value == "12.5"
        assert lab_test.result.validated_at is None

        ValidateLabResultUseCase().execute(lab_test)
        lab_test.refresh_from_db()
        assert lab_test.status == LabProcessStatus.VALIDATED
        assert lab_test.result.validated_at is not None

        lab_order = LabOrder.all_objects.get(id=lab_test.lab_order_id)
        assert lab_order.status == LabProcessStatus.VALIDATED

    def test_no_se_puede_tomar_muestra_fuera_de_orden(self, organization, lab_test):
        # lab_test sigue en ORDERED, no en SAMPLE_PENDING.
        with pytest.raises(domain_exceptions.ConflictError):
            CollectSampleUseCase().execute(lab_test, CollectSampleRequest(sample_type="Sangre"))

    def test_no_se_puede_validar_sin_resultado(self, organization, lab_test):
        TransitionLabTestUseCase().execute(lab_test, LabProcessStatus.SAMPLE_PENDING)
        CollectSampleUseCase().execute(lab_test, CollectSampleRequest(sample_type="Sangre"))
        TransitionLabTestUseCase().execute(lab_test, LabProcessStatus.PROCESSING)

        with pytest.raises(domain_exceptions.ConflictError):
            ValidateLabResultUseCase().execute(lab_test)
