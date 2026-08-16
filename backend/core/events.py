"""Bus de eventos de dominio mínimo (docs/roadmap.md, Fase 6).

Síncrono e in-process a propósito: alcanza para desacoplar quién dispara
un evento (los casos de uso de `appointments`, `payments`, etc.) de quién
reacciona a él (notificaciones internas ahora; webhooks públicos en la
Fase 12B). No es una cola de mensajes — si se necesita procesamiento
asíncrono, el propio handler debe encolar una tarea de Celery.

Un handler que lanza una excepción no debe romper el flujo principal
(p. ej. que falle el envío de un email no debe impedir que la cita se
haya creado): los errores se registran como `error` y se silencian.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable

logger = logging.getLogger("app")

_HandlerType = Callable[..., None]

_subscribers: dict[str, list[_HandlerType]] = defaultdict(list)


def subscribe(event_name: str, handler: _HandlerType) -> None:
    _subscribers[event_name].append(handler)


def on(event_name: str) -> Callable[[_HandlerType], _HandlerType]:
    """Decorador: `@on("appointment.created")`."""

    def decorator(handler: _HandlerType) -> _HandlerType:
        subscribe(event_name, handler)
        return handler

    return decorator


def emit(event_name: str, **payload) -> None:
    for handler in _subscribers.get(event_name, []):
        try:
            handler(**payload)
        except Exception:
            logger.error(
                "Error en handler de evento de dominio",
                exc_info=True,
                extra={"event": f"domain_event.handler_error.{event_name}", "severity": "error"},
            )
