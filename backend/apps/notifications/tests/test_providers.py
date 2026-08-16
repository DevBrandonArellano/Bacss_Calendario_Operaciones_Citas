import pytest
from django.core import mail

from apps.notifications.models import NotificationChannel
from apps.notifications.providers import (
    EmailProvider,
    InternalProvider,
    ProviderError,
    SmsProvider,
    WhatsAppProvider,
    get_provider,
)

pytestmark = pytest.mark.django_db


class TestEmailProvider:
    def test_envia_correo(self):
        EmailProvider().send(to="cliente@test.com", subject="Asunto", body="Cuerpo")
        assert len(mail.outbox) == 1
        assert mail.outbox[0].subject == "Asunto"

    def test_sin_destinatario_lanza_provider_error(self):
        with pytest.raises(ProviderError):
            EmailProvider().send(to="", subject="Asunto", body="Cuerpo")


class TestStubsWhatsappSms:
    def test_whatsapp_no_lanza_excepcion(self):
        WhatsAppProvider().send(to="+593999999999", subject="", body="Recordatorio")

    def test_sms_no_lanza_excepcion(self):
        SmsProvider().send(to="+593999999999", subject="", body="Recordatorio")


class TestInternalProvider:
    def test_no_hace_nada(self):
        assert InternalProvider().send(to="", subject="", body="") is None


class TestGetProvider:
    @pytest.mark.parametrize(
        ("channel", "expected_type"),
        [
            (NotificationChannel.EMAIL, EmailProvider),
            (NotificationChannel.WHATSAPP, WhatsAppProvider),
            (NotificationChannel.SMS, SmsProvider),
            (NotificationChannel.INTERNAL, InternalProvider),
        ],
    )
    def test_resuelve_el_proveedor_por_canal(self, channel, expected_type):
        assert isinstance(get_provider(channel), expected_type)

    def test_canal_no_soportado_lanza_provider_error(self):
        with pytest.raises(ProviderError):
            get_provider("carrier_pigeon")
