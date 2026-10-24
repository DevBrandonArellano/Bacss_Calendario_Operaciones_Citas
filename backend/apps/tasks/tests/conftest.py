import pytest

from apps.customers.models import Customer


@pytest.fixture
def customer(organization):
    return Customer.all_objects.create(organization=organization, first_name="Rosa", last_name="Salinas")
