"""Abstracción de proveedor de notificaciones (docs/roadmap.md, Fase 6).

Cada canal implementa la misma interfaz (`NotificationProvider`), así el
caso de uso de envío (`apps.notifications.services`) no conoce los
detalles de SMTP/WhatsApp/SMS (DIP, ver CLAUDE.md). WhatsApp y SMS quedan
como stubs detrás de la misma interfaz hasta que se integre un proveedor
real en la 2ª etapa (docs/roadmap.md).
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger("app")


class ProviderError(Exception):
    """El envío falló del lado del proveedor (red, credenciales, rechazo, etc.)."""


class NotificationProvider(ABC):
    @abstractmethod
    def send(self, *, to: str, subject: str, body: str) -> None:
        """Envía el mensaje. Debe lanzar `ProviderError` si falla."""


class EmailProvider(NotificationProvider):
    def send(self, *, to: str, subject: str, body: str) -> None:
        if not to:
            raise ProviderError("El destinatario de email está vacío.")
        try:
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=False)
        except Exception as exc:  # backend de email puede lanzar distintas excepciones
            raise ProviderError(str(exc)) from exc


class WhatsAppProvider(NotificationProvider):
    """Stub: registra el intento, no envía nada real todavía (2ª etapa, docs/roadmap.md)."""

    def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info(
            "Envío de WhatsApp (stub, sin integración real)",
            extra={"event": "notification.whatsapp.stub", "severity": "info", "data": {"to": to}},
        )


class SmsProvider(NotificationProvider):
    """Stub: registra el intento, no envía nada real todavía (2ª etapa, docs/roadmap.md)."""

    def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info(
            "Envío de SMS (stub, sin integración real)",
            extra={"event": "notification.sms.stub", "severity": "info", "data": {"to": to}},
        )


class InternalProvider(NotificationProvider):
    """Canal interno: la notificación ya vive en la tabla `Notification`, no hay envío externo."""

    def send(self, *, to: str, subject: str, body: str) -> None:
        return None


def get_provider(channel: str) -> NotificationProvider:
    from apps.notifications.models import NotificationChannel

    mapping: dict[str, type[NotificationProvider]] = {
        NotificationChannel.EMAIL: EmailProvider,
        NotificationChannel.WHATSAPP: WhatsAppProvider,
        NotificationChannel.SMS: SmsProvider,
        NotificationChannel.INTERNAL: InternalProvider,
    }
    provider_cls = mapping.get(channel)
    if provider_cls is None:
        raise ProviderError(f"Canal de notificación no soportado: {channel}")
    return provider_cls()
