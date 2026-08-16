import pytest

from apps.branches.models import Branch
from apps.organizations.models import Organization
from core.context import set_current_organization_id

pytestmark = pytest.mark.django_db


def test_branch_manager_filters_by_current_organization():
    org_a = Organization.objects.create(name="Motors Ecuador")
    org_b = Organization.objects.create(name="Laboratorio ABC")
    Branch.objects.all_objects.create(organization=org_a, name="Sucursal Norte")
    Branch.objects.all_objects.create(organization=org_b, name="Sucursal Centro")

    set_current_organization_id(org_a.id)
    try:
        names = list(Branch.objects.values_list("name", flat=True))
    finally:
        set_current_organization_id(None)

    assert names == ["Sucursal Norte"]


def test_branch_manager_returns_empty_without_organization_in_context():
    org = Organization.objects.create(name="Motors Ecuador")
    Branch.objects.all_objects.create(organization=org, name="Sucursal Norte")

    set_current_organization_id(None)

    assert list(Branch.objects.all()) == []


def test_branch_unique_name_per_organization():
    from django.db import IntegrityError

    org = Organization.objects.create(name="Motors Ecuador")
    Branch.objects.all_objects.create(organization=org, name="Sucursal Norte")

    with pytest.raises(IntegrityError):
        Branch.objects.all_objects.create(organization=org, name="Sucursal Norte")
