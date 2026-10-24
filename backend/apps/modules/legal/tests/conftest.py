import pytest

from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.modules.legal.models import LegalCase
from apps.organizations.models import ModuleActivation, ModuleCode
from apps.services.models import Employee


@pytest.fixture
def legal_active(organization):
    return ModuleActivation.objects.create(organization=organization, module_code=ModuleCode.LEGAL)


@pytest.fixture
def branch(organization):
    return Branch.all_objects.create(organization=organization, name="Sede Principal")


@pytest.fixture
def customer(organization):
    return Customer.all_objects.create(
        organization=organization, first_name="Rosa", last_name="Salinas"
    )


@pytest.fixture
def lawyer(organization, branch):
    return Employee.all_objects.create(
        organization=organization, branch=branch, first_name="Marco", last_name="Abogado"
    )


@pytest.fixture
def legal_case(organization, customer, lawyer):
    return LegalCase.all_objects.create(
        organization=organization,
        case_number="CASE-001",
        customer=customer,
        case_type="Civil",
        responsible_lawyer=lawyer,
    )
