import pytest
from django.db import IntegrityError

from apps.customers.models import Customer
from core.context import set_current_organization_id

pytestmark = pytest.mark.django_db


def test_full_name_combines_first_and_last_name(organization):
    customer = Customer.all_objects.create(organization=organization, first_name="Ana", last_name="Pérez")

    assert customer.full_name == "Ana Pérez"


def test_manager_filters_by_current_organization(organization, other_organization):
    Customer.all_objects.create(organization=organization, first_name="Propio", last_name="Cliente")
    Customer.all_objects.create(organization=other_organization, first_name="Ajeno", last_name="Cliente")

    set_current_organization_id(organization.id)
    try:
        names = list(Customer.objects.values_list("first_name", flat=True))
    finally:
        set_current_organization_id(None)

    assert names == ["Propio"]


def test_document_number_unique_per_organization(organization):
    Customer.all_objects.create(
        organization=organization, first_name="A", last_name="A", document_number="0102030405"
    )

    with pytest.raises(IntegrityError):
        Customer.all_objects.create(
            organization=organization, first_name="B", last_name="B", document_number="0102030405"
        )


def test_blank_document_number_does_not_collide(organization):
    Customer.all_objects.create(organization=organization, first_name="A", last_name="A")
    # No debe lanzar IntegrityError: la constraint excluye document_number vacío.
    Customer.all_objects.create(organization=organization, first_name="B", last_name="B")


def test_same_document_number_allowed_across_organizations(organization, other_organization):
    Customer.all_objects.create(
        organization=organization, first_name="A", last_name="A", document_number="0102030405"
    )
    # No debe lanzar: la unicidad es por organización, no global.
    Customer.all_objects.create(
        organization=other_organization, first_name="B", last_name="B", document_number="0102030405"
    )
