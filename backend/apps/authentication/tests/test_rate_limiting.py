import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from apps.users.models import User

pytestmark = pytest.mark.django_db


@override_settings(
    REST_FRAMEWORK={
        "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
        "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
        "DEFAULT_PAGINATION_CLASS": "core.pagination.DefaultPageNumberPagination",
        "PAGE_SIZE": 20,
        "EXCEPTION_HANDLER": "core.exception_handler.domain_exception_handler",
        "DEFAULT_THROTTLE_RATES": {"auth": "2/min"},
    }
)
def test_login_endpoint_is_rate_limited(api_client, organization):
    User.objects.create_user(organization=organization, email="user@test.com", password="Password123!")

    for _ in range(2):
        response = api_client.post(
            reverse("auth-login"), {"email": "user@test.com", "password": "wrong"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    throttled_response = api_client.post(
        reverse("auth-login"), {"email": "user@test.com", "password": "wrong"}, format="json"
    )

    assert throttled_response.status_code == status.HTTP_429_TOO_MANY_REQUESTS
