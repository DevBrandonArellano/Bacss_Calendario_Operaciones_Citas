import pytest

from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.modules.store.models import Product, ProductVariant
from apps.organizations.models import ModuleActivation, ModuleCode


@pytest.fixture
def store_active(organization):
    return ModuleActivation.objects.create(organization=organization, module_code=ModuleCode.STORE)


@pytest.fixture
def branch(organization):
    return Branch.all_objects.create(organization=organization, name="Sede Principal")


@pytest.fixture
def customer(organization):
    return Customer.all_objects.create(organization=organization, first_name="Ana", last_name="Torres")


@pytest.fixture
def product(organization):
    return Product.all_objects.create(
        organization=organization, sku="CAM-001", name="Camiseta", price="20.00"
    )


@pytest.fixture
def variant(organization, product):
    return ProductVariant.all_objects.create(
        organization=organization, product=product, sku="CAM-001-M", stock=10
    )
