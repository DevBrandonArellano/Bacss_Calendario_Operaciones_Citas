from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from django.core import mail
from django.utils import timezone
from freezegun import freeze_time

from apps.notifications.models import Notification, NotificationSetting
from apps.notifications.tasks import send_appointment_reminders

pytestmark = pytest.mark.django_db


def _appointment_datetime(appointment):
    return timezone.make_aware(datetime.combine(appointment.appointment_date, appointment.start_time))


class TestSendAppointmentReminders:
    def test_envia_recordatorio_por_email_dentro_de_la_ventana(self, organization, appointment):
        NotificationSetting.all_objects.create(
            organization=organization, reminder_offsets_hours=[24], email_enabled=True
        )
        frozen_now = _appointment_datetime(appointment) - timedelta(hours=24)

        with freeze_time(frozen_now):
            sent = send_appointment_reminders()

        assert sent == 1
        assert len(mail.outbox) == 1
        notification = Notification.all_objects.get()
        assert notification.event_code == "appointment.reminder.24h"

    def test_no_duplica_si_ya_se_envio(self, organization, appointment):
        NotificationSetting.all_objects.create(
            organization=organization, reminder_offsets_hours=[24], email_enabled=True
        )
        frozen_now = _appointment_datetime(appointment) - timedelta(hours=24)

        with freeze_time(frozen_now):
            send_appointment_reminders()
            sent_again = send_appointment_reminders()

        assert sent_again == 0
        assert len(mail.outbox) == 1

    def test_fuera_de_la_ventana_no_envia(self, organization, appointment):
        NotificationSetting.all_objects.create(
            organization=organization, reminder_offsets_hours=[24], email_enabled=True
        )
        frozen_now = _appointment_datetime(appointment) - timedelta(hours=48)

        with freeze_time(frozen_now):
            sent = send_appointment_reminders()

        assert sent == 0
        assert len(mail.outbox) == 0

    def test_canal_deshabilitado_no_envia(self, organization, appointment):
        NotificationSetting.all_objects.create(
            organization=organization, reminder_offsets_hours=[24], email_enabled=False
        )
        frozen_now = _appointment_datetime(appointment) - timedelta(hours=24)

        with freeze_time(frozen_now):
            sent = send_appointment_reminders()

        assert sent == 0
        assert len(mail.outbox) == 0

    def test_proveedor_mockeado_es_invocado_en_vez_de_enviar_directo(self, organization, appointment):
        """'disparo de tareas (proveedor mock)' del checklist de Fase 6."""
        NotificationSetting.all_objects.create(
            organization=organization, reminder_offsets_hours=[24], email_enabled=True
        )
        frozen_now = _appointment_datetime(appointment) - timedelta(hours=24)

        with (
            freeze_time(frozen_now),
            patch("apps.notifications.services.get_provider") as mock_get_provider,
        ):
            sent = send_appointment_reminders()

        assert sent == 1
        mock_get_provider.return_value.send.assert_called_once()
