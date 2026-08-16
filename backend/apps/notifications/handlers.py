"""Suscriptores del bus de eventos de dominio (`core.events`) que generan
notificaciones automáticas. Se registran una sola vez, en
`NotificationsConfig.ready()`.

Dos destinatarios posibles por evento de cita:

- El **profesional asignado**, por canal interno (centro de notificaciones
  de la UI de staff), solo si tiene cuenta de usuario (`Employee.user`,
  nullable — ver `docs/erd.md`).
- El **cliente**, por email, si tiene `email` registrado y el canal está
  habilitado en `NotificationSetting` de la organización. El cliente no
  recibe notificación por canal interno: hoy no existe mecanismo de login
  para clientes (portal de reserva pública, pendiente de diseño), así que
  el canal interno solo aplica a usuarios con cuenta.
"""

from __future__ import annotations


def _appointment_context(appointment) -> dict:
    return {
        "customer_name": appointment.customer.full_name,
        "service_name": appointment.service.name,
        "appointment_date": str(appointment.appointment_date),
        "start_time": str(appointment.start_time),
    }


def _notify_for_appointment(appointment, event_code: str) -> None:
    from apps.notifications.models import NotificationChannel
    from apps.notifications.services import CreateNotificationUseCase, get_notification_settings

    organization = appointment.organization
    context = _appointment_context(appointment)
    use_case = CreateNotificationUseCase(organization=organization)

    if appointment.employee.user_id:
        use_case.execute(
            event_code=event_code,
            channel=NotificationChannel.INTERNAL,
            context=context,
            recipient_user=appointment.employee.user,
        )

    settings_row = get_notification_settings(organization)
    email_enabled = settings_row.email_enabled if settings_row else True
    if email_enabled and appointment.customer.email:
        use_case.execute(
            event_code=event_code,
            channel=NotificationChannel.EMAIL,
            context=context,
            customer=appointment.customer,
            to_address=appointment.customer.email,
        )


def on_appointment_created(*, appointment, **_kwargs) -> None:
    _notify_for_appointment(appointment, "appointment.created")


def on_appointment_confirmed(*, appointment, **_kwargs) -> None:
    _notify_for_appointment(appointment, "appointment.confirmed")


def on_appointment_cancelled(*, appointment, **_kwargs) -> None:
    _notify_for_appointment(appointment, "appointment.cancelled")


def on_appointment_rescheduled(*, old_appointment, new_appointment, **_kwargs) -> None:
    _notify_for_appointment(new_appointment, "appointment.rescheduled")


def register() -> None:
    from core import events

    events.subscribe("appointment.created", on_appointment_created)
    events.subscribe("appointment.confirmed", on_appointment_confirmed)
    events.subscribe("appointment.cancelled", on_appointment_cancelled)
    events.subscribe("appointment.rescheduled", on_appointment_rescheduled)
