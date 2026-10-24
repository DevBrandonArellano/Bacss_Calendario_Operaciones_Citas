import pytest
from django.urls import reverse
from rest_framework import status

from apps.audit.models import AuditAction
from apps.audit.services import log_action

pytestmark = pytest.mark.django_db


def test_login_is_recorded_in_audit_log(api_client, organization):
    from apps.users.models import User

    User.objects.create_user(organization=organization, email="user@test.com", password="Password123!")

    api_client.post(
        reverse("auth-login"), {"email": "user@test.com", "password": "Password123!"}, format="json"
    )

    from apps.audit.models import AuditLog

    # all_objects: el login ocurre sin usuario autenticado todavía, así que
    # no hay organización en el contexto para que AuditLog.objects (ahora
    # tenant-scoped) la resuelva — la escritura sí lleva la organización
    # correcta (log_action la recibe explícita), solo la lectura de este
    # test necesita el manager sin filtro.
    assert AuditLog.all_objects.filter(action=AuditAction.LOGIN, entity_type="User").exists()


def test_audit_log_list_never_returns_other_organization_entries(
    auth_client, organization, other_organization, org_admin_user
):
    log_action(action=AuditAction.LOGIN, entity_type="User", organization=organization, user=org_admin_user)
    log_action(action=AuditAction.LOGIN, entity_type="User", organization=other_organization, user=None)

    response = auth_client.get(reverse("audit-log-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 1


def test_audit_log_requires_permission(api_client, organization, make_user, system_roles):
    from rest_framework_simplejwt.tokens import RefreshToken

    reception_user = make_user(organization, "recepcion@test.com", roles=["reception"])
    token = RefreshToken.for_user(reception_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")

    response = api_client.get(reverse("audit-log-list"))

    assert response.status_code == status.HTTP_403_FORBIDDEN
