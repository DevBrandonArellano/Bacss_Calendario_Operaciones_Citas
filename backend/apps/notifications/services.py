"""Casos de uso de notificaciones (docs/roadmap.md, Fase 6).

Resuelve la plantilla aplicable (organización > global), la renderiza y
delega el envío al proveedor del canal. Es el único punto de escritura de
`Notification` — tanto los handlers de eventos de dominio como las tareas
de Celery (recordatorios) pasan por aquí, igual que el motor de reservas
es el único punto de escritura de `Appointment`.
"""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone

from apps.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationSetting,
    NotificationStatus,
    NotificationTemplate,
)
from apps.notifications.providers import ProviderError, get_provider
from core import exceptions as domain_exceptions
from core.context import tenant_scope


def resolve_template(*, organization, event_code: str, channel: str) -> NotificationTemplate | None:
    """Devuelve la plantilla de la organización si existe; si no, la global."""

    return (
        NotificationTemplate.objects.filter(
            Q(organization=organization) | Q(organization__isnull=True),
            event_code=event_code,
            channel=channel,
            is_active=True,
        )
        # NULLS LAST por defecto en orden ascendente: la fila de la
        # organización (no nula) queda antes que la plantilla global.
        .order_by("organization")
        .first()
    )


def get_notification_settings(organization) -> NotificationSetting | None:
    return NotificationSetting.all_objects.filter(organization=organization).first()


def _render_template(template: NotificationTemplate | None, context: dict) -> tuple[str, str]:
    if template is None:
        return "", ""
    try:
        subject = template.subject_template.format(**context)
        body = template.body_template.format(**context)
    except (KeyError, IndexError) as exc:
        raise domain_exceptions.ValidationError(
            "La plantilla de notificación referencia un dato no provisto.",
            details={"missing": str(exc)},
        ) from exc
    return subject, body


class CreateNotificationUseCase:
    """Genera y envía (o encola) una notificación para un evento de dominio."""

    def __init__(self, *, organization):
        self.organization = organization

    def execute(
        self,
        *,
        event_code: str,
        channel: str,
        context: dict,
        recipient_user=None,
        customer=None,
        to_address: str = "",
    ) -> Notification:
        with tenant_scope(self.organization.id):
            return self._execute(
                event_code=event_code,
                channel=channel,
                context=context,
                recipient_user=recipient_user,
                customer=customer,
                to_address=to_address,
            )

    def _execute(
        self,
        *,
        event_code: str,
        channel: str,
        context: dict,
        recipient_user=None,
        customer=None,
        to_address: str = "",
    ) -> Notification:
        template = resolve_template(organization=self.organization, event_code=event_code, channel=channel)
        subject, body = _render_template(template, context)

        notification = Notification.objects.create(
            organization=self.organization,
            recipient_user=recipient_user,
            customer=customer,
            channel=channel,
            event_code=event_code,
            payload=context,
            subject=subject,
            body=body,
        )
        self._send(notification, to_address=to_address)
        return notification

    def _send(self, notification: Notification, *, to_address: str) -> None:
        if notification.channel == NotificationChannel.INTERNAL:
            self._mark_sent(notification)
            return

        provider = get_provider(notification.channel)
        try:
            provider.send(to=to_address, subject=notification.subject, body=notification.body)
        except ProviderError as exc:
            notification.status = NotificationStatus.FAILED
            notification.error_message = str(exc)
            notification.save(update_fields=["status", "error_message", "updated_at"])
            return
        self._mark_sent(notification)

    @staticmethod
    def _mark_sent(notification: Notification) -> None:
        notification.status = NotificationStatus.SENT
        notification.sent_at = timezone.now()
        notification.save(update_fields=["status", "sent_at", "updated_at"])


def mark_as_read(notification: Notification) -> Notification:
    notification.status = NotificationStatus.READ
    notification.read_at = timezone.now()
    notification.save(update_fields=["status", "read_at", "updated_at"])
    return notification
