"""Exception handler global de DRF (docs/error-handling.md).

Devuelve siempre el mismo formato de error:
    {"code": ..., "message": ..., "details": ..., "request_id": ...}
y nunca filtra stack traces ni datos internos al cliente.
"""

from __future__ import annotations

import logging

from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_handler

from core import exceptions as domain_exceptions
from core.context import get_correlation_id

logger = logging.getLogger("app")

_DOMAIN_TO_HTTP = {
    domain_exceptions.ValidationError: status.HTTP_400_BAD_REQUEST,
    domain_exceptions.PermissionDeniedError: status.HTTP_403_FORBIDDEN,
    domain_exceptions.NotFoundError: status.HTTP_404_NOT_FOUND,
    domain_exceptions.ConflictError: status.HTTP_409_CONFLICT,
    domain_exceptions.RateLimitExceededError: status.HTTP_429_TOO_MANY_REQUESTS,
    domain_exceptions.DomainError: status.HTTP_422_UNPROCESSABLE_ENTITY,
}

# Severidades esperadas (no son bugs) vs. inesperadas, para el logging RFC 5424.
_EXPECTED_SEVERITY = "warning"
_UNEXPECTED_SEVERITY = "error"


def _build_error_response(code: str, message: str, details: dict, http_status: int) -> Response:
    return Response(
        {
            "code": code,
            "message": message,
            "details": details,
            "request_id": get_correlation_id(),
        },
        status=http_status,
    )


def domain_exception_handler(exc, context):
    request_id = get_correlation_id()

    if isinstance(exc, domain_exceptions.DomainError):
        http_status = _DOMAIN_TO_HTTP.get(type(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)
        logger.log(
            logging.WARNING,
            exc.message,
            extra={
                "event": f"error.{exc.code}",
                "severity": _EXPECTED_SEVERITY,
                "request_id": request_id,
            },
        )
        return _build_error_response(exc.code, exc.message, exc.details, http_status)

    if isinstance(exc, Http404):
        return _build_error_response(
            domain_exceptions.NotFoundError.code,
            domain_exceptions.NotFoundError.default_message,
            {},
            status.HTTP_404_NOT_FOUND,
        )

    # Excepciones nativas de DRF (validación de serializer, auth, throttling, etc.)
    response = drf_default_handler(exc, context)
    if response is not None:
        code = _code_for_drf_exception(exc)
        details = response.data if isinstance(response.data, dict) else {"errors": response.data}
        logger.log(
            logging.WARNING,
            str(exc),
            extra={"event": f"error.{code}", "severity": _EXPECTED_SEVERITY, "request_id": request_id},
        )
        return _build_error_response(
            code, _message_for_drf_exception(exc), details, response.status_code
        )

    # Excepción no anticipada: se registra como error, no se filtra detalle al cliente.
    logger.log(
        logging.ERROR,
        "Excepción no manejada",
        exc_info=True,
        extra={
            "event": "error.unexpected",
            "severity": _UNEXPECTED_SEVERITY,
            "request_id": request_id,
        },
    )
    return _build_error_response(
        "internal_error",
        "Ocurrió un error inesperado. Contacte a soporte con el request_id.",
        {},
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _code_for_drf_exception(exc: Exception) -> str:
    mapping = {
        drf_exceptions.ValidationError: "validation_error",
        drf_exceptions.AuthenticationFailed: "authentication_failed",
        drf_exceptions.NotAuthenticated: "not_authenticated",
        drf_exceptions.PermissionDenied: "permission_denied",
        drf_exceptions.Throttled: "rate_limit_exceeded",
        drf_exceptions.NotFound: "not_found",
        drf_exceptions.MethodNotAllowed: "method_not_allowed",
    }
    for exc_type, code in mapping.items():
        if isinstance(exc, exc_type):
            return code
    return "request_error"


def _message_for_drf_exception(exc: Exception) -> str:
    detail = getattr(exc, "detail", None)
    if isinstance(detail, str):
        return detail
    return "La solicitud no pudo procesarse."
