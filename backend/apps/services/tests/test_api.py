import pytest
from django.urls import reverse
from rest_framework import status

from apps.services.models import Employee, Service

pytestmark = pytest.mark.django_db


def test_create_service_assigns_organization_from_authenticated_user(auth_client, organization):
    response = auth_client.post(
        reverse("service-list"),
        {"name": "Cambio de aceite", "duration_minutes": 45, "price": "25.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    service = Service.objects.all_objects.get(id=response.data["id"])
    assert service.organization_id == organization.id


def test_create_service_rejects_zero_duration(auth_client):
    response = auth_client.post(
        reverse("service-list"),
        {"name": "Servicio inválido", "duration_minutes": 0, "price": "10.00"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_list_services_never_returns_other_organization_data(
    auth_client, organization, other_organization
):
    Service.objects.all_objects.create(
        organization=organization, name="Propio", duration_minutes=30, price="10.00"
    )
    Service.objects.all_objects.create(
        organization=other_organization, name="Ajeno", duration_minutes=30, price="10.00"
    )

    response = auth_client.get(reverse("service-list"))

    names = [s["name"] for s in response.data["results"]]
    assert names == ["Propio"]


def test_reception_can_read_but_not_write_services(api_client, organization, make_user, system_roles):
    from rest_framework_simplejwt.tokens import RefreshToken

    reception_user = make_user(organization, "recepcion@test.com", roles=["reception"])
    token = RefreshToken.for_user(reception_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    read_response = api_client.get(reverse("service-list"))
    write_response = api_client.post(
        reverse("service-list"), {"name": "X", "duration_minutes": 30, "price": "1.00"}, format="json"
    )

    assert read_response.status_code == status.HTTP_200_OK
    assert write_response.status_code == status.HTTP_403_FORBIDDEN


def test_create_employee(auth_client, organization):
    response = auth_client.post(
        reverse("employee-list"), {"first_name": "Carlos", "last_name": "Mecánico"}, format="json"
    )

    assert response.status_code == status.HTTP_201_CREATED
    employee = Employee.objects.all_objects.get(id=response.data["id"])
    assert employee.organization_id == organization.id


def test_list_employees_never_returns_other_organization_data(
    auth_client, organization, other_organization
):
    Employee.objects.all_objects.create(organization=organization, first_name="Propio", last_name="Empleado")
    Employee.objects.all_objects.create(
        organization=other_organization, first_name="Ajeno", last_name="Empleado"
    )

    response = auth_client.get(reverse("employee-list"))

    names = [e["first_name"] for e in response.data["results"]]
    assert names == ["Propio"]


def test_assign_services_to_employee(auth_client, organization):
    service = Service.objects.all_objects.create(
        organization=organization, name="Corte", duration_minutes=30, price="10.00"
    )
    employee = Employee.objects.all_objects.create(
        organization=organization, first_name="Carlos", last_name="Mecánico"
    )

    response = auth_client.post(
        reverse("employee-set-services", args=[employee.id]),
        {"service_ids": [str(service.id)]},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    employee.refresh_from_db()
    assert list(employee.services.all()) == [service]


def test_assign_services_ignores_service_from_other_organization(
    auth_client, organization, other_organization
):
    foreign_service = Service.objects.all_objects.create(
        organization=other_organization, name="Ajeno", duration_minutes=30, price="10.00"
    )
    employee = Employee.objects.all_objects.create(
        organization=organization, first_name="Carlos", last_name="Mecánico"
    )

    response = auth_client.post(
        reverse("employee-set-services", args=[employee.id]),
        {"service_ids": [str(foreign_service.id)]},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    employee.refresh_from_db()
    assert list(employee.services.all()) == []
