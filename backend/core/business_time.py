from __future__ import annotations

from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

FALLBACK_TIME_ZONE = "UTC"


def business_today(organization) -> date:
    """Fecha de hoy según la zona horaria de la empresa.

    El servidor corre en UTC, pero las citas se agendan en la hora local del negocio: usar
    `date.today()` hace que, de noche, «hoy» sea ya el día siguiente. Una zona inválida o la
    ausencia de organización caen en UTC en vez de romper la consulta.
    """
    zone_name = getattr(organization, "timezone", None) or FALLBACK_TIME_ZONE
    try:
        zone = ZoneInfo(zone_name)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo(FALLBACK_TIME_ZONE)
    return timezone.now().astimezone(zone).date()
