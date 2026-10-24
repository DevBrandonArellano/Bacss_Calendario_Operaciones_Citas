import pytest

from apps.branches.models import Branch
from apps.modules.laboratory.models import LabOrder, LabProcessStatus, LabTest, Patient
from apps.organizations.models import ModuleActivation, ModuleCode
from apps.services.models import Employee


@pytest.fixture
def lab_active(organization):
    return ModuleActivation.objects.create(organization=organization, module_code=ModuleCode.LABORATORY)


@pytest.fixture
def branch(organization):
    return Branch.all_objects.create(organization=organization, name="Sede Principal")


@pytest.fixture
def ordering_employee(organization, branch):
    return Employee.all_objects.create(
        organization=organization, branch=branch, first_name="Andrea", last_name="Bioquímica"
    )


@pytest.fixture
def patient(organization):
    return Patient.all_objects.create(organization=organization, first_name="Elena", last_name="Ramírez")


@pytest.fixture
def lab_order(organization, patient, ordering_employee):
    return LabOrder.all_objects.create(
        organization=organization, patient=patient, ordering_employee=ordering_employee
    )


@pytest.fixture
def lab_test(organization, lab_order):
    return LabTest.all_objects.create(
        organization=organization,
        lab_order=lab_order,
        test_code="HEM001",
        test_name="Hemograma completo",
        status=LabProcessStatus.ORDERED,
    )
