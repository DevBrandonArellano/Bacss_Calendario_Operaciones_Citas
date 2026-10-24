import pytest
from django.urls import reverse
from rest_framework import status

pytestmark = pytest.mark.django_db


def test_error_response_has_uniform_shape(api_client):
    response = api_client.post(
        reverse("auth-login"), {"email": "no@existe.com", "password": "x"}, format="json"
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    body = response.json()
    assert set(["code", "message", "details", "request_id"]).issubset(body.keys())
    assert body["request_id"]


def test_response_includes_correlation_id_header(api_client):
    response = api_client.get(reverse("branch-list"))

    assert "X-Request-Id" in response.headers


def test_incoming_correlation_id_is_propagated(api_client):
    response = api_client.get(reverse("branch-list"), HTTP_X_REQUEST_ID="test-correlation-123")

    assert response.headers["X-Request-Id"] == "test-correlation-123"


def test_not_found_of_foreign_tenant_resource_does_not_leak_403(auth_client, other_organization):
    from apps.branches.models import Branch

    foreign = Branch.all_objects.create(organization=other_organization, name="Ajena")

    response = auth_client.get(reverse("branch-detail", args=[foreign.id]))

    body = response.json()
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert body["code"] == "not_found"
