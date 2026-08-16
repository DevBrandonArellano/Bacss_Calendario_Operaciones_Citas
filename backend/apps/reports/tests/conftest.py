from datetime import date, time

import pytest

from apps.appointments.models import Appointment
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.services.models import Employee, Service


@pytest.fixture
def branch(organization):
    return Branch.objects.all_objects.create(organization=organization, name="Sede Principal")


@pytest.fixture
def service(organization):
    return Service.objects.all_objects.create(
        organization=organization, name="Corte", duration_minutes=30, price="15.00"
    )


@pytest.fixture
def employee(organization, branch):
    return Employee.objects.all_objects.create(
        organization=organization, branch=branch, first_name="Ana", last_name="Estilista"
    )


@pytest.fixture
def customer(organization):
    return Customer.objects.all_objects.create(organization=organization, first_name="Rosa", last_name="Salinas")


@pytest.fixture
def make_appointment(organization, branch, service):
    def _make(*, employee, customer, appointment_date=None, status="completed", price="15.00"):
        return Appointment.objects.all_objects.create(
            organization=organization,
            branch=branch,
            customer=customer,
            service=service,
            employee=employee,
            appointment_date=appointment_date or date.today(),
            start_time=time(10, 0),
            end_time=time(10, 30),
            duration_minutes=30,
            status=status,
            price=price,
        )

    return _make
