from datetime import date, time, timedelta

import pytest

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.services.models import Employee, Service
from apps.users.models import User


@pytest.fixture
def branch(organization):
    return Branch.objects.all_objects.create(organization=organization, name="Sucursal Norte")


@pytest.fixture
def service(organization):
    return Service.objects.all_objects.create(
        organization=organization, name="Corte", duration_minutes=30, price="10.00"
    )


@pytest.fixture
def employee_user(organization):
    return User.objects.create_user(
        organization=organization, email="profesional@test.com", password="Password123!"
    )


@pytest.fixture
def employee(organization, branch, service, employee_user):
    emp = Employee.objects.all_objects.create(
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
    return Customer.objects.all_objects.create(
        organization=organization, first_name="Cliente", last_name="Uno", email="cliente@test.com"
    )


@pytest.fixture
def appointment(organization, branch, service, employee, customer):
    target_date = date.today() + timedelta(days=1)
    return Appointment.objects.all_objects.create(
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
