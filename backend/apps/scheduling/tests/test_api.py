from datetime import time, timedelta

import pytest
from django.urls import reverse
from rest_framework import status

from apps.branches.models import Branch
from apps.scheduling.models import Schedule
from apps.services.models import Employee, Service

pytestmark = pytest.mark.django_db


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
        organization=organization, branch=branch, first_name="Ana", last_name="P"
    )
    emp.services.add(service)
    return emp


def test_create_schedule_requires_branch_or_employee(auth_client):
    response = auth_client.post(
        reverse("schedule-list"),
        {"weekday": 0, "start_time": "09:00", "end_time": "17:00"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_create_schedule_rejects_end_before_start(auth_client, branch):
    response = auth_client.post(
        reverse("schedule-list"),
        {"branch": str(branch.id), "weekday": 0, "start_time": "17:00", "end_time": "09:00"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_create_schedule_assigns_organization(auth_client, organization, branch):
    response = auth_client.post(
        reverse("schedule-list"),
        {"branch": str(branch.id), "weekday": 0, "start_time": "09:00", "end_time": "17:00"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    schedule = Schedule.all_objects.get(id=response.data["id"])
    assert schedule.organization_id == organization.id


def test_list_schedules_never_returns_other_organization_data(
    auth_client, organization, other_organization, branch
):
    Schedule.all_objects.create(
        organization=organization, branch=branch, weekday=0, start_time=time(9, 0), end_time=time(17, 0)
    )
    other_branch = Branch.all_objects.create(organization=other_organization, name="Ajena")
    Schedule.all_objects.create(
        organization=other_organization,
        branch=other_branch,
        weekday=0,
        start_time=time(9, 0),
        end_time=time(17, 0),
    )

    response = auth_client.get(reverse("schedule-list"))

    assert response.data["count"] == 1


def test_availability_endpoint_returns_slots(auth_client, organization, branch, employee, service):
    from datetime import date

    target = date.today() + timedelta(days=(7 - date.today().weekday()) % 7 or 7)
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

    response = auth_client.get(
        reverse("availability"),
        {"service_id": str(service.id), "branch_id": str(branch.id), "date": str(target)},
    )

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data["slots"]) > 0


def test_availability_endpoint_rejects_unknown_service(auth_client, branch):
    from datetime import date

    response = auth_client.get(
        reverse("availability"),
        {
            "service_id": "00000000-0000-0000-0000-000000000000",
            "branch_id": str(branch.id),
            "date": str(date.today()),
        },
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
