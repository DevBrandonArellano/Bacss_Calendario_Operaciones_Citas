from datetime import UTC, datetime

import pytest
from freezegun import freeze_time

from apps.reports import services

pytestmark = pytest.mark.django_db


def test_el_dashboard_cuenta_las_citas_de_hoy_segun_la_zona_horaria_del_negocio(
    organization, org_admin_user, make_appointment, employee, customer
):
    """A las 22:30 en Guayaquil el servidor (UTC) ya está en el día siguiente: «hoy» debe seguir
    siendo el día local del negocio, no la fecha del servidor."""
    from datetime import date

    with freeze_time(datetime(2026, 10, 24, 3, 30, tzinfo=UTC)):
        make_appointment(employee=employee, customer=customer, appointment_date=date(2026, 10, 23))
        make_appointment(employee=employee, customer=customer, appointment_date=date(2026, 10, 24))

        summary = services.get_dashboard_summary(organization=organization, user=org_admin_user)

    assert summary["today_total"] == 1
