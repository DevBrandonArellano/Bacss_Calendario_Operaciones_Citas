from datetime import UTC, date, datetime

import pytest
from freezegun import freeze_time

from core.business_time import business_today

pytestmark = pytest.mark.django_db


class _Org:
    def __init__(self, tz: str):
        self.timezone = tz


def test_usa_la_fecha_local_del_negocio_y_no_la_del_servidor():
    # 03:30 UTC del 24 = 22:30 del 23 en Guayaquil (UTC-5).
    with freeze_time(datetime(2026, 10, 24, 3, 30, tzinfo=UTC)):
        assert business_today(_Org("America/Guayaquil")) == date(2026, 10, 23)
        assert business_today(_Org("UTC")) == date(2026, 10, 24)


def test_zona_invalida_cae_en_utc_sin_romper():
    with freeze_time(datetime(2026, 10, 24, 3, 30, tzinfo=UTC)):
        assert business_today(_Org("No/Existe")) == date(2026, 10, 24)


def test_sin_organizacion_usa_utc():
    with freeze_time(datetime(2026, 10, 24, 3, 30, tzinfo=UTC)):
        assert business_today(None) == date(2026, 10, 24)
