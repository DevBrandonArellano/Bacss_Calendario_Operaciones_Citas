import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.services.models import Employee, Service

pytestmark = pytest.mark.django_db


def _make_service(organization, **kwargs):
    defaults = {"name": "Corte de cabello", "duration_minutes": 30, "price": "10.00"}
    defaults.update(kwargs)
    return Service.objects.all_objects.create(organization=organization, **defaults)


@pytest.mark.parametrize("duration", [1, 30, 480])
def test_valid_durations_are_accepted(organization, duration):
    service = _make_service(organization, duration_minutes=duration)
    service.full_clean()

    assert service.duration_minutes == duration


@pytest.mark.parametrize("duration", [0, -1, -30])
def test_non_positive_durations_are_rejected(organization, duration):
    service = _make_service(organization, duration_minutes=duration)

    with pytest.raises(ValidationError):
        service.full_clean()


def test_negative_price_is_rejected(organization):
    service = _make_service(organization, price="-1.00")

    with pytest.raises(ValidationError):
        service.full_clean()


def test_service_name_unique_per_organization(organization):
    _make_service(organization, name="Corte de cabello")

    with pytest.raises(IntegrityError):
        _make_service(organization, name="Corte de cabello")


def test_employee_full_name(organization):
    employee = Employee.objects.all_objects.create(
        organization=organization, first_name="Carlos", last_name="Mecánico"
    )

    assert employee.full_name == "Carlos Mecánico"


def test_employee_services_relation(organization):
    service = _make_service(organization)
    employee = Employee.objects.all_objects.create(
        organization=organization, first_name="Carlos", last_name="Mecánico"
    )

    employee.services.add(service)

    assert list(employee.services.all()) == [service]
    assert list(service.employees.all()) == [employee]
