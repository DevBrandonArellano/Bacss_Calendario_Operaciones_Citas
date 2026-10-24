import pytest
from django.db import IntegrityError

from apps.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationSetting,
    NotificationStatus,
    NotificationTemplate,
)

pytestmark = pytest.mark.django_db


class TestNotificationTemplate:
    def test_unicidad_por_organizacion_evento_canal(self, organization):
        NotificationTemplate.objects.create(
            organization=organization,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="hola",
        )
        with pytest.raises(IntegrityError):
            NotificationTemplate.objects.create(
                organization=organization,
                event_code="appointment.confirmed",
                channel=NotificationChannel.EMAIL,
                body_template="hola de nuevo",
            )

    def test_plantilla_global_y_de_organizacion_coexisten(self, organization):
        NotificationTemplate.objects.create(
            organization=None,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="global",
        )
        override = NotificationTemplate.objects.create(
            organization=organization,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="override",
        )
        assert override.organization_id == organization.id


class TestNotificationSetting:
    def test_unico_por_organizacion(self, organization):
        NotificationSetting.all_objects.create(organization=organization, reminder_offsets_hours=[24])
        with pytest.raises(IntegrityError):
            NotificationSetting.all_objects.create(
                organization=organization, reminder_offsets_hours=[2]
            )


class TestNotification:
    def test_valores_por_defecto(self, organization, customer):
        notification = Notification.all_objects.create(
            organization=organization,
            customer=customer,
            channel=NotificationChannel.EMAIL,
            event_code="appointment.confirmed",
        )
        assert notification.status == NotificationStatus.QUEUED
        assert notification.payload == {}
        assert notification.read_at is None
