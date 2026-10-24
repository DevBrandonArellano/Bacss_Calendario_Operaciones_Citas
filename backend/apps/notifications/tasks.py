"""Tareas Celery de Fase 6: recordatorios programados (docs/roadmap.md).

Tarea periódica (Celery beat) que recorre las citas activas próximas y
dispara un recordatorio por cada offset configurado en
`NotificationSetting.reminder_offsets_hours` de cada organización, sin
duplicar el mismo recordatorio si la tarea corre más de una vez dentro de
la ventana de tolerancia.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from celery import shared_task
from django.utils import timezone

from apps.appointments.models import ACTIVE_APPOINTMENT_STATUSES, Appointment
from apps.notifications.models import Notification, NotificationChannel, NotificationSetting
from apps.notifications.services import CreateNotificationUseCase

logger = logging.getLogger("app")

# Margen de tolerancia del scheduler: el beat debe correr esta tarea al
# menos cada REMINDER_WINDOW_MINUTES para no saltarse ninguna cita.
REMINDER_WINDOW_MINUTES = 15


def _appointment_datetime(appointment: Appointment) -> datetime:
    return timezone.make_aware(datetime.combine(appointment.appointment_date, appointment.start_time))


def _reminder_event_code(offset_hours: int) -> str:
    return f"appointment.reminder.{offset_hours}h"


def _already_reminded(appointment: Appointment, event_code: str) -> bool:
    return Notification.all_objects.filter(
        organization=appointment.organization,
        customer=appointment.customer,
        event_code=event_code,
        payload__appointment_id=str(appointment.id),
    ).exists()


def _send_reminder(*, use_case, setting, appointment, offset_hours: int) -> bool:
    """Recordatorio dirigido al cliente (no existe login de cliente aún, ver
    `apps.notifications.handlers`) por cada canal externo habilitado en
    `NotificationSetting`, detrás de la misma interfaz de proveedor.

    Devuelve `True` si se envió al menos un canal.
    """

    event_code = _reminder_event_code(offset_hours)
    if _already_reminded(appointment, event_code):
        return False

    context = {
        "customer_name": appointment.customer.full_name,
        "service_name": appointment.service.name,
        "appointment_date": str(appointment.appointment_date),
        "start_time": str(appointment.start_time),
        "offset_hours": offset_hours,
        "appointment_id": str(appointment.id),
    }

    channels: list[tuple[str, str]] = []
    if setting.email_enabled and appointment.customer.email:
        channels.append((NotificationChannel.EMAIL, appointment.customer.email))
    if setting.sms_enabled and appointment.customer.phone:
        channels.append((NotificationChannel.SMS, appointment.customer.phone))
    if setting.whatsapp_enabled and appointment.customer.phone:
        channels.append((NotificationChannel.WHATSAPP, appointment.customer.phone))

    if not channels:
        return False

    for channel, to_address in channels:
        use_case.execute(
            event_code=event_code,
            channel=channel,
            context=context,
            customer=appointment.customer,
            to_address=to_address,
        )
    return True


@shared_task(name="notifications.send_appointment_reminders")
def send_appointment_reminders() -> int:
    """Recorre las configuraciones de recordatorio y envía los que correspondan.

    Idempotente: `_already_reminded` evita reenviar el mismo recordatorio
    para la misma cita si la tarea vuelve a correr dentro de la ventana.
    """

    now = timezone.now()
    sent_count = 0

    for setting in NotificationSetting.all_objects.select_related("organization"):
        organization = setting.organization
        use_case = CreateNotificationUseCase(organization=organization)

        for offset_hours in setting.reminder_offsets_hours:
            target_from = now + timedelta(hours=offset_hours)
            target_to = target_from + timedelta(minutes=REMINDER_WINDOW_MINUTES)

            appointments = Appointment.all_objects.filter(
                organization=organization,
                status__in=ACTIVE_APPOINTMENT_STATUSES,
                appointment_date__range=(target_from.date(), target_to.date()),
            ).select_related("customer", "service")

            for appointment in appointments:
                if not (target_from <= _appointment_datetime(appointment) < target_to):
                    continue
                sent = _send_reminder(
                    use_case=use_case, setting=setting, appointment=appointment, offset_hours=offset_hours
                )
                if sent:
                    sent_count += 1

    logger.info(
        "Recordatorios de citas procesados",
        extra={
            "event": "notification.reminders.processed",
            "severity": "info",
            "data": {"count": sent_count},
        },
    )
    return sent_count
