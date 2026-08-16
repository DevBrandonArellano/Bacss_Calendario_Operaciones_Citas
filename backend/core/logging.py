"""Logging estructurado JSON conforme a docs/logging.md (niveles RFC 5424)."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from core.context import get_correlation_id, get_current_organization_id

_RFC5424_BY_LEVELNO = {
    logging.CRITICAL: "critical",
    logging.ERROR: "error",
    logging.WARNING: "warning",
    logging.INFO: "info",
    logging.DEBUG: "debug",
}

_SENSITIVE_KEYS = {"password", "token", "access", "refresh", "secret", "authorization"}


class CorrelationIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = get_correlation_id()
        if not hasattr(record, "organization_id"):
            record.organization_id = get_current_organization_id()
        return True


def _scrub(data: dict) -> dict:
    return {
        key: ("***" if key.lower() in _SENSITIVE_KEYS else value)
        for key, value in data.items()
    }


class StructuredJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        severity = getattr(record, "severity", None) or _RFC5424_BY_LEVELNO.get(
            record.levelno, "info"
        )
        payload = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "severity": severity,
            "service": "backend-api",
            "organization_id": getattr(record, "organization_id", None),
            "user_id": getattr(record, "user_id", None),
            "request_id": getattr(record, "request_id", None),
            "event": getattr(record, "event", record.name),
            "message": record.getMessage(),
        }
        extra_data = getattr(record, "data", None)
        if extra_data:
            payload["data"] = _scrub(extra_data)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)
