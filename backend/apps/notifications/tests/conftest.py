from datetime import date, time, timedelta

import pytest

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.scheduling.models import Schedule
from apps.services.models import Employee, Service
from apps.users.models import User


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
def employee_user(organization):
    return User.objects.create_user(
        organization=organization, email="profesional@test.com", password="Password123!"
    )


@pytest.fixture
def employee(organization, branch, service, employee_user):
    emp = Employee.all_objects.create(
        organization=organization,
        branch=branch,
        first_name="Ana",
        last_name="Prof",
        user=employee_user,
    )
    emp.services.add(service)
    return emp


@pytest.fixture
def customer(organization):
    return Customer.all_objects.create(
        organization=organization, first_name="Cliente", last_name="Uno", email="cliente@test.com"
    )


@pytest.fixture
def monday(organization, branch, employee):
    """Sin `Schedule` configurado no hay disponibilidad (motor de
    disponibilidad, `apps/scheduling/engine.py`), así que cualquier test que
    cree una cita necesita un horario laboral real, no solo una fecha
    relativa (`date.today() + timedelta(...)` puede caer cualquier día)."""
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


@pytest.fixture
def appointment(organization, branch, service, employee, customer):
    target_date = date.today() + timedelta(days=1)
    return Appointment.all_objects.create(
        organization=organization,
        branch=branch,
        customer=customer,
        service=service,
        employee=employee,
        appointment_date=target_date,
        start_time=time(10, 0),
        end_time=time(10, 30),
        duration_minutes=30,
        price="10.00",
        status=AppointmentStatus.CONFIRMED,
    )
