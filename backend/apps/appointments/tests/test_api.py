from datetime import time

import pytest
from django.urls import reverse
from rest_framework import status

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.services.models import Employee, Service

pytestmark = pytest.mark.django_db


def _create_payload(customer, service, employee, branch, monday, **overrides):
    payload = {
        "customer_id": str(customer.id),
        "service_id": str(service.id),
        "employee_id": str(employee.id),
        "branch_id": str(branch.id),
        "appointment_date": str(monday),
        "start_time": "10:00",
    }
    payload.update(overrides)
    return payload


def test_create_appointment_via_api(auth_client, organization, customer, service, employee, branch, monday):
    response = auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    appointment = Appointment.objects.all_objects.get(id=response.data["id"])
    assert appointment.organization_id == organization.id
    assert appointment.status == AppointmentStatus.CONFIRMED


def test_create_appointment_conflict_returns_409(auth_client, customer, service, employee, branch, monday):
    auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )

    response = auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday, start_time="10:15"),
        format="json",
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.data["code"] == "conflict"


def test_list_appointments_never_returns_other_organization_data(
    auth_client, organization, other_organization, customer, service, employee, branch, monday
):
    auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )

    other_branch = Branch.objects.all_objects.create(organization=other_organization, name="Ajena")
    other_customer = Customer.objects.all_objects.create(
        organization=other_organization, first_name="Ajeno", last_name="Cliente"
    )
    other_service = Service.objects.all_objects.create(
        organization=other_organization, name="Ajeno", duration_minutes=30, price="1.00"
    )
    other_employee = Employee.objects.all_objects.create(
        organization=other_organization, branch=other_branch, first_name="Ajeno", last_name="Prof"
    )
    Appointment.objects.all_objects.create(
        organization=other_organization,
        branch=other_branch,
        customer=other_customer,
        service=other_service,
        employee=other_employee,
        appointment_date=monday,
        start_time=time(10, 0),
        end_time=time(10, 30),
        duration_minutes=30,
        price="1.00",
        status=AppointmentStatus.CONFIRMED,
    )

    response = auth_client.get(reverse("appointment-list"))

    assert response.data["count"] == 1


def test_list_appointments_filters_by_date_range(auth_client, customer, service, employee, branch, monday):
    auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )

    response = auth_client.get(
        reverse("appointment-list"),
        {"appointment_date__gte": str(monday), "appointment_date__lte": str(monday)},
    )
    assert response.data["count"] == 1

    from datetime import timedelta

    response_out_of_range = auth_client.get(
        reverse("appointment-list"),
        {
            "appointment_date__gte": str(monday + timedelta(days=1)),
            "appointment_date__lte": str(monday + timedelta(days=7)),
        },
    )
    assert response_out_of_range.data["count"] == 0


def test_confirm_pending_appointment(auth_client, customer, service, employee, branch, monday):
    create_response = auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday, requires_confirmation=True),
        format="json",
    )
    appointment_id = create_response.data["id"]
    assert create_response.data["status"] == AppointmentStatus.PENDING

    response = auth_client.post(reverse("appointment-confirm", args=[appointment_id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == AppointmentStatus.CONFIRMED


def test_cancel_appointment(auth_client, customer, service, employee, branch, monday):
    create_response = auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )
    appointment_id = create_response.data["id"]

    response = auth_client.post(
        reverse("appointment-cancel", args=[appointment_id]), {"reason": "Cliente canceló"}, format="json"
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == AppointmentStatus.CANCELLED


def test_cannot_cancel_completed_appointment(auth_client, customer, service, employee, branch, monday):
    create_response = auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )
    appointment_id = create_response.data["id"]
    auth_client.post(reverse("appointment-start", args=[appointment_id]))
    auth_client.post(reverse("appointment-complete", args=[appointment_id]))

    response = auth_client.post(reverse("appointment-cancel", args=[appointment_id]), {}, format="json")

    assert response.status_code == status.HTTP_409_CONFLICT


def test_reschedule_appointment_frees_original_slot(auth_client, customer, service, employee, branch, monday):
    create_response = auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )
    appointment_id = create_response.data["id"]

    response = auth_client.post(
        reverse("appointment-reschedule", args=[appointment_id]),
        {"appointment_date": str(monday), "start_time": "14:00"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["start_time"] == "14:00:00"

    # El slot original (10:00) debe quedar libre otra vez.
    retry = auth_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )
    assert retry.status_code == status.HTTP_201_CREATED


def test_reception_can_create_appointment_professional_cannot_write_customers(
    api_client, organization, customer, service, employee, branch, monday, make_user, system_roles
):
    from rest_framework_simplejwt.tokens import RefreshToken

    reception_user = make_user(organization, "recepcion@test.com", roles=["reception"])
    token = RefreshToken.for_user(reception_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    response = api_client.post(
        reverse("appointment-list"),
        _create_payload(customer, service, employee, branch, monday),
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
