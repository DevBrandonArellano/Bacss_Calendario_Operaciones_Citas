from datetime import date, time, timedelta

import pytest

from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.scheduling.models import Schedule
from apps.services.models import Employee, Service


def next_monday() -> date:
    today = date.today()
    return today + timedelta(days=(7 - today.weekday()) % 7 or 7)


@pytest.fixture
def branch(organization):
    return Branch.all_objects.create(organization=organization, name="Sucursal Norte")


@pytest.fixture
def service(organization):
    return Service.all_objects.create(
        organization=organization, name="Corte", duration_minutes=30, price="10.00"
    )


@pytest.fixture
def employee(organization, branch, service):
    emp = Employee.all_objects.create(
        organization=organization, branch=branch, first_name="Ana", last_name="Prof"
    )
    emp.services.add(service)
    return emp


@pytest.fixture
def customer(organization):
    return Customer.all_objects.create(
        organization=organization, first_name="Cliente", last_name="Uno"
    )


@pytest.fixture
def monday(organization, branch, employee):
    target = next_monday()
    Schedule.all_objects.create(
        organization=organization,
        branch=branch,
        weekday=target.weekday(),
        start_time=time(9, 0),
        end_time=time(17, 0),
    )
    Schedule.all_objects.create(
        organization=organization,
        employee=employee,
        weekday=target.weekday(),
        start_time=time(9, 0),
        end_time=time(17, 0),
    )
    return target
