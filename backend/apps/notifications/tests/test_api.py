import pytest
from django.urls import reverse
from rest_framework import status

from apps.notifications.models import Notification, NotificationChannel, NotificationStatus

pytestmark = pytest.mark.django_db


@pytest.fixture
def other_org_user(other_organization, system_roles, make_user):
    return make_user(other_organization, "otro@laboratorioabc.test", roles=["org_admin"])


def _create_notification(organization, recipient_user, **overrides):
    fields = {
        "organization": organization,
        "recipient_user": recipient_user,
        "channel": NotificationChannel.INTERNAL,
        "event_code": "appointment.created",
        "status": NotificationStatus.SENT,
    }
    fields.update(overrides)
    return Notification.objects.all_objects.create(**fields)


class TestNotificationList:
    def test_lista_solo_las_del_usuario_autenticado(
        self, auth_client, organization, org_admin_user, other_org_user, other_organization
    ):
        mine = _create_notification(organization, org_admin_user)
        _create_notification(organization, None)  # sin destinatario, no debe verla nadie por API
        _create_notification(other_organization, other_org_user)

        response = auth_client.get(reverse("notification-list"))

        assert response.status_code == status.HTTP_200_OK
        ids = [item["id"] for item in response.data["results"]]
        assert ids == [str(mine.id)]

    def test_requiere_autenticacion(self, api_client):
        response = api_client.get(reverse("notification-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestMarkNotificationAsRead:
    def test_marca_como_leida(self, auth_client, organization, org_admin_user):
        notification = _create_notification(organization, org_admin_user, status=NotificationStatus.SENT)

        response = auth_client.post(reverse("notification-read", args=[notification.id]))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == NotificationStatus.READ
        notification.refresh_from_db()
        assert notification.read_at is not None

    def test_no_puede_marcar_como_leida_una_notificacion_ajena(
        self, auth_client, other_organization, other_org_user
    ):
        notification = _create_notification(other_organization, other_org_user)

        response = auth_client.post(reverse("notification-read", args=[notification.id]))

        assert response.status_code == status.HTTP_404_NOT_FOUND
