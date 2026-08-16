"""Taxonomía de excepciones de dominio (docs/error-handling.md).

Independiente de DRF/HTTP: la capa de servicios lanza estas excepciones sin
saber a qué código HTTP se van a mapear. El mapeo vive en
`core.exception_handler`.
"""

from __future__ import annotations


class DomainError(Exception):
    """Excepción de negocio genérica. Código por defecto: `domain_error`."""

    code = "domain_error"
    default_message = "Ocurrió un error de negocio."

    def __init__(self, message: str | None = None, details: dict | None = None):
        self.message = message or self.default_message
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(DomainError):
    code = "validation_error"
    default_message = "Los datos enviados no son válidos."


class PermissionDeniedError(DomainError):
    code = "permission_denied"
    default_message = "No tiene permiso para realizar esta acción."


class NotFoundError(DomainError):
    code = "not_found"
    default_message = "El recurso solicitado no existe."


class ConflictError(DomainError):
    code = "conflict"
    default_message = "La operación entra en conflicto con el estado actual."


class RateLimitExceededError(DomainError):
    code = "rate_limit_exceeded"
    default_message = "Se excedió el límite de solicitudes."
