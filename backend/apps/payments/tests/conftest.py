from datetime import date, time, timedelta

import pytest

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.services.models import Employee, Service


@pytest.fixture
def branch(organization):
    return Branch.all_objects.create(organization=organization, name="Sucursal Norte")


@pytest.fixture
def service(organization):
    return Service.all_objects.create(
        organization=organization, name="Corte", duration_minutes=30, price="50.00"
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
        organization=organization, first_name="Cliente", last_name="Uno", email="cliente@test.com"
    )


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
        price="50.00",
        status=AppointmentStatus.CONFIRMED,
    )
