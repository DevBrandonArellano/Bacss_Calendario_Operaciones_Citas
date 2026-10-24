import pytest

from apps.customers.models import Customer
from apps.modules.moto.models import Motorcycle
from apps.organizations.models import ModuleActivation, ModuleCode


@pytest.fixture
def moto_active(organization):
    return ModuleActivation.objects.create(organization=organization, module_code=ModuleCode.MOTO)


@pytest.fixture
def customer(organization):
    return Customer.all_objects.create(organization=organization, first_name="Cliente", last_name="Uno")


@pytest.fixture
def motorcycle(organization, customer):
    return Motorcycle.all_objects.create(
        organization=organization, customer=customer, plate="ABC-123", brand="Yamaha", model="FZ"
    )
