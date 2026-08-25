import pytest
from django.urls import reverse
from rest_framework import status

from apps.customers.models import Customer

pytestmark = pytest.mark.django_db


def test_create_customer_assigns_organization_from_authenticated_user(auth_client, organization):
    response = auth_client.post(
        reverse("customer-list"), {"first_name": "Ana", "last_name": "Pérez"}, format="json"
    )

    assert response.status_code == status.HTTP_201_CREATED
    customer = Customer.objects.all_objects.get(id=response.data["id"])
    assert customer.organization_id == organization.id


def test_create_customer_ignores_organization_sent_in_body(auth_client, organization, other_organization):
    response = auth_client.post(
        reverse("customer-list"),
        {"first_name": "Ana", "last_name": "Pérez", "organization": str(other_organization.id)},
        format="json",
    )

    customer = Customer.objects.all_objects.get(id=response.data["id"])
    assert customer.organization_id == organization.id


def test_list_customers_never_returns_other_organization_data(auth_client, organization, other_organization):
    Customer.objects.all_objects.create(organization=organization, first_name="Propio", last_name="Cliente")
    Customer.objects.all_objects.create(
        organization=other_organization, first_name="Ajeno", last_name="Cliente"
    )

    response = auth_client.get(reverse("customer-list"))

    names = [c["first_name"] for c in response.data["results"]]
    assert names == ["Propio"]


def test_update_customer(auth_client, organization):
    customer = Customer.objects.all_objects.create(
        organization=organization, first_name="Ana", last_name="Pérez"
    )

    response = auth_client.patch(
        reverse("customer-detail", args=[customer.id]), {"phone": "0999999999"}, format="json"
    )

    assert response.status_code == status.HTTP_200_OK
    customer.refresh_from_db()
    assert customer.phone == "0999999999"


def test_delete_customer(auth_client, organization):
    customer = Customer.objects.all_objects.create(
        organization=organization, first_name="Ana", last_name="Pérez"
    )

    response = auth_client.delete(reverse("customer-detail", args=[customer.id]))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not Customer.objects.all_objects.filter(id=customer.id).exists()


def test_cannot_delete_customer_of_other_organization(auth_client, other_organization):
    foreign = Customer.objects.all_objects.create(
        organization=other_organization, first_name="Ajeno", last_name="Cliente"
    )

    response = auth_client.delete(reverse("customer-detail", args=[foreign.id]))

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert Customer.objects.all_objects.filter(id=foreign.id).exists()


@pytest.mark.parametrize(
    "query,expected_names",
    [
        ("Ana", ["Ana"]),
        ("perez", ["Ana", "Bruno"]),  # coincide por apellido en ambos (case-insensitive)
        ("0999", ["Ana"]),  # coincide por teléfono
        ("zzz-no-existe", []),
    ],
)
def test_search_matches_name_document_phone_and_email(auth_client, organization, query, expected_names):
    Customer.objects.all_objects.create(
        organization=organization, first_name="Ana", last_name="Perez", phone="0999999999"
    )
    Customer.objects.all_objects.create(
        organization=organization, first_name="Bruno", last_name="Perez", phone="0888888888"
    )

    response = auth_client.get(reverse("customer-search"), {"q": query})

    names = sorted(c["first_name"] for c in response.data["results"])
    assert names == sorted(expected_names)


def test_search_never_returns_other_organization_data(auth_client, organization, other_organization):
    Customer.objects.all_objects.create(organization=organization, first_name="Ana", last_name="Perez")
    Customer.objects.all_objects.create(organization=other_organization, first_name="Ana", last_name="Ajena")

    response = auth_client.get(reverse("customer-search"), {"q": "Ana"})

    last_names = [c["last_name"] for c in response.data["results"]]
    assert last_names == ["Perez"]


def test_history_endpoint_returns_customer_summary(auth_client, organization):
    customer = Customer.objects.all_objects.create(
        organization=organization, first_name="Ana", last_name="Perez"
    )

    response = auth_client.get(reverse("customer-history", args=[customer.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["full_name"] == "Ana Perez"
    assert response.data["appointments"] == []


def test_history_of_foreign_customer_returns_404(auth_client, other_organization):
    foreign = Customer.objects.all_objects.create(
        organization=other_organization, first_name="Ana", last_name="Ajena"
    )

    response = auth_client.get(reverse("customer-history", args=[foreign.id]))

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_reception_can_create_customer(api_client, organization, make_user, system_roles):
    from rest_framework_simplejwt.tokens import RefreshToken

    reception_user = make_user(organization, "recepcion@test.com", roles=["reception"])
    token = RefreshToken.for_user(reception_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    response = api_client.post(
        reverse("customer-list"), {"first_name": "Ana", "last_name": "Pérez"}, format="json"
    )

    assert response.status_code == status.HTTP_201_CREATED


def test_professional_cannot_create_customer(api_client, organization, make_user, system_roles):
    from rest_framework_simplejwt.tokens import RefreshToken

    professional_user = make_user(organization, "profesional@test.com", roles=["professional"])
    token = RefreshToken.for_user(professional_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    response = api_client.post(
        reverse("customer-list"), {"first_name": "Ana", "last_name": "Pérez"}, format="json"
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
