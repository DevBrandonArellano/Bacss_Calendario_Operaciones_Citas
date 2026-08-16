import pytest
from django.db import IntegrityError

from apps.modules.laboratory.models import LabProcessStatus, Patient

pytestmark = pytest.mark.django_db


class TestPatient:
    def test_documento_unico_por_organizacion(self, organization):
        Patient.objects.all_objects.create(
            organization=organization, first_name="A", last_name="B", document_number="0102030405"
        )
        with pytest.raises(IntegrityError):
            Patient.objects.all_objects.create(
                organization=organization, first_name="C", last_name="D", document_number="0102030405"
            )

    def test_documento_vacio_no_colisiona(self, organization):
        Patient.objects.all_objects.create(organization=organization, first_name="A", last_name="B")
        # No debe lanzar: el constraint excluye document_number vacío.
        Patient.objects.all_objects.create(organization=organization, first_name="C", last_name="D")


class TestLabTestTransitions:
    @pytest.mark.parametrize(
        ("current", "target", "expected"),
        [
            (LabProcessStatus.ORDERED, LabProcessStatus.SAMPLE_PENDING, True),
            (LabProcessStatus.ORDERED, LabProcessStatus.PROCESSING, False),
            (LabProcessStatus.SAMPLE_PENDING, LabProcessStatus.SAMPLE_TAKEN, True),
            (LabProcessStatus.SAMPLE_TAKEN, LabProcessStatus.PROCESSING, True),
            (LabProcessStatus.PROCESSING, LabProcessStatus.RESULT_AVAILABLE, True),
            (LabProcessStatus.RESULT_AVAILABLE, LabProcessStatus.VALIDATED, True),
            (LabProcessStatus.VALIDATED, LabProcessStatus.DELIVERED, True),
            (LabProcessStatus.DELIVERED, LabProcessStatus.ORDERED, False),
            (LabProcessStatus.RESULT_AVAILABLE, LabProcessStatus.DELIVERED, False),
        ],
    )
    def test_tabla_de_decision_transiciones(self, organization, lab_order, current, target, expected):
        from apps.modules.laboratory.models import LabTest

        test = LabTest.objects.all_objects.create(
            organization=organization,
            lab_order=lab_order,
            test_code="X",
            test_name="Prueba",
            status=current,
        )
        assert test.can_transition_to(target) is expected
