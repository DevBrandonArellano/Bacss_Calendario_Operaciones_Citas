from unittest.mock import patch

import pytest
from django.core import mail

from apps.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationStatus,
    NotificationTemplate,
)
from apps.notifications.providers import ProviderError
from apps.notifications.services import CreateNotificationUseCase, mark_as_read, resolve_template
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


class TestResolveTemplate:
    def test_prefiere_plantilla_de_la_organizacion_sobre_la_global(self, organization):
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

        resolved = resolve_template(
            organization=organization, event_code="appointment.confirmed", channel=NotificationChannel.EMAIL
        )

        assert resolved.id == override.id

    def test_usa_la_global_si_no_hay_override(self, organization):
        global_template = NotificationTemplate.objects.create(
            organization=None,
            event_code="appointment.cancelled",
            channel=NotificationChannel.EMAIL,
            body_template="global",
        )

        resolved = resolve_template(
            organization=organization, event_code="appointment.cancelled", channel=NotificationChannel.EMAIL
        )

        assert resolved.id == global_template.id

    def test_ninguna_plantilla_devuelve_none(self, organization):
        resolved = resolve_template(
            organization=organization, event_code="sin.plantilla", channel=NotificationChannel.EMAIL
        )
        assert resolved is None


class TestCreateNotificationUseCaseCanalInterno:
    def test_canal_interno_no_llama_proveedor_y_queda_enviada(self, organization, customer):
        use_case = CreateNotificationUseCase(organization=organization)
        notification = use_case.execute(
            event_code="appointment.created",
            channel=NotificationChannel.INTERNAL,
            context={"customer_name": customer.full_name},
            customer=customer,
        )

        assert notification.status == NotificationStatus.SENT
        assert notification.sent_at is not None


class TestCreateNotificationUseCaseEmail:
    def test_renderiza_plantilla_y_envia_email(self, organization, customer):
        NotificationTemplate.objects.create(
            organization=organization,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            subject_template="Cita confirmada para {customer_name}",
            body_template="Hola {customer_name}, tu cita de {service_name} quedó confirmada.",
        )
        use_case = CreateNotificationUseCase(organization=organization)

        notification = use_case.execute(
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            context={"customer_name": customer.full_name, "service_name": "Corte"},
            customer=customer,
            to_address="cliente@test.com",
        )

        assert notification.status == NotificationStatus.SENT
        assert notification.subject == f"Cita confirmada para {customer.full_name}"
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["cliente@test.com"]

    def test_plantilla_con_variable_faltante_lanza_validation_error(self, organization, customer):
        NotificationTemplate.objects.create(
            organization=organization,
            event_code="appointment.confirmed",
            channel=NotificationChannel.EMAIL,
            body_template="Hola {customer_name}, tu cita con {employee_name} quedó confirmada.",
        )
        use_case = CreateNotificationUseCase(organization=organization)

        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                event_code="appointment.confirmed",
                channel=NotificationChannel.EMAIL,
                context={"customer_name": customer.full_name},
                customer=customer,
                to_address="cliente@test.com",
            )

    def test_falla_del_proveedor_marca_notificacion_como_fallida(self, organization, customer):
        use_case = CreateNotificationUseCase(organization=organization)

        with patch("apps.notifications.services.get_provider") as mock_get_provider:
            mock_get_provider.return_value.send.side_effect = ProviderError("SMTP caído")
            notification = use_case.execute(
                event_code="appointment.confirmed",
                channel=NotificationChannel.EMAIL,
                context={},
                customer=customer,
                to_address="cliente@test.com",
            )

        assert notification.status == NotificationStatus.FAILED
        assert "SMTP caído" in notification.error_message


class TestMarkAsRead:
    def test_marca_leida_y_registra_fecha(self, organization, customer):
        notification = Notification.all_objects.create(
            organization=organization,
            customer=customer,
            channel=NotificationChannel.INTERNAL,
            event_code="appointment.confirmed",
        )

        mark_as_read(notification)
        notification.refresh_from_db()

        assert notification.status == NotificationStatus.READ
        assert notification.read_at is not None
