"""Agregaciones de reportes y dashboard (docs/roadmap.md, Fase 12).

Todas las agregaciones pesadas viven aquí, no en las vistas (CLAUDE.md:
"Agregaciones pesadas en servicios/tareas, no en vistas"; ISO 25010,
eficiencia de desempeño). Las vistas (`views.py`) solo parsean parámetros
y devuelven lo que estas funciones calculan con el ORM.

Alcance por rol (docs/auth-rbac.md, fila "Reportes"): un profesional (con
`employee_profile`) solo ve sus propias cifras de citas/productividad —
igual heurística de alcance que reutilizan `core/owner_access.py` (Fase
11B) y `LegalCaseViewSet` (Fase 11), sin necesidad de una tabla de roles
nueva. Las cifras financieras (ingresos) exigen el permiso separado
`reports:financial` (solo Admin), independiente del alcance por empleado.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek

from core.context import tenant_scope

TRUNC_FUNCS = {"day": TruncDay, "week": TruncWeek, "month": TruncMonth}


def _employee_scope(user):
    return getattr(user, "employee_profile", None)


def get_dashboard_summary(*, organization, user) -> dict:
    from apps.appointments.models import Appointment, AppointmentStatus
    from apps.customers.models import Customer
    from apps.payments.models import Payment, PaymentStatus

    with tenant_scope(organization.id):
        today = date.today()
        employee = _employee_scope(user)

        today_qs = Appointment.objects.filter(appointment_date=today)
        upcoming_qs = Appointment.objects.filter(
            appointment_date__gt=today,
            appointment_date__lte=today + timedelta(days=7),
            status__in=[AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        )
        if employee is not None:
            today_qs = today_qs.filter(employee=employee)
            upcoming_qs = upcoming_qs.filter(employee=employee)

        today_by_status = dict(today_qs.values_list("status").annotate(count=Count("id")))

        summary: dict = {
            "today_total": sum(today_by_status.values()),
            "today_by_status": today_by_status,
            "upcoming_7_days": upcoming_qs.count(),
        }

        if user.has_permission("reports:financial"):
            month_start = today.replace(day=1)
            summary["new_customers_this_month"] = Customer.objects.filter(
                registered_at__date__gte=month_start
            ).count()
            summary["revenue_this_month"] = Payment.objects.filter(
                status=PaymentStatus.PAID, paid_at__date__gte=month_start
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0")

        return summary


def get_chart_data(
    *, organization, user, metric: str, group_by: str, date_from: date, date_to: date
) -> list[dict]:
    trunc = TRUNC_FUNCS.get(group_by)
    if trunc is None:
        from core import exceptions as domain_exceptions

        raise domain_exceptions.ValidationError("'group_by' debe ser 'day', 'week' o 'month'.")

    with tenant_scope(organization.id):
        if metric == "appointments":
            return _appointments_series(user, trunc, date_from, date_to)
        if metric == "revenue":
            return _revenue_series(user, trunc, date_from, date_to)
        if metric == "new_customers":
            return _new_customers_series(user, trunc, date_from, date_to)
        if metric == "top_services":
            return _top_services(user, date_from, date_to)

        from core import exceptions as domain_exceptions

        raise domain_exceptions.ValidationError(
            "'metric' debe ser 'appointments', 'revenue', 'new_customers' o 'top_services'."
        )


def _appointments_series(user, trunc, date_from: date, date_to: date) -> list[dict]:
    from apps.appointments.models import Appointment

    qs = Appointment.objects.filter(appointment_date__gte=date_from, appointment_date__lte=date_to)
    employee = _employee_scope(user)
    if employee is not None:
        qs = qs.filter(employee=employee)

    rows = (
        qs.annotate(period=trunc("appointment_date"))
        .values("period")
        .annotate(count=Count("id"))
        .order_by("period")
    )
    return [{"period": row["period"].isoformat(), "count": row["count"]} for row in rows]


def _revenue_series(user, trunc, date_from: date, date_to: date) -> list[dict]:
    from apps.payments.models import Payment, PaymentStatus

    if not user.has_permission("reports:financial"):
        return []

    rows = (
        Payment.objects.filter(
            status=PaymentStatus.PAID, paid_at__date__gte=date_from, paid_at__date__lte=date_to
        )
        .annotate(period=trunc("paid_at"))
        .values("period")
        .annotate(total=Sum("amount"))
        .order_by("period")
    )
    return [{"period": row["period"].date().isoformat(), "total": row["total"]} for row in rows]


def _new_customers_series(user, trunc, date_from: date, date_to: date) -> list[dict]:
    from apps.customers.models import Customer

    if not user.has_permission("reports:financial"):
        return []

    rows = (
        Customer.objects.filter(registered_at__date__gte=date_from, registered_at__date__lte=date_to)
        .annotate(period=trunc("registered_at"))
        .values("period")
        .annotate(count=Count("id"))
        .order_by("period")
    )
    return [{"period": row["period"].date().isoformat(), "count": row["count"]} for row in rows]


def _top_services(user, date_from: date, date_to: date, limit: int = 10) -> list[dict]:
    from apps.appointments.models import Appointment

    qs = Appointment.objects.filter(appointment_date__gte=date_from, appointment_date__lte=date_to)
    employee = _employee_scope(user)
    if employee is not None:
        qs = qs.filter(employee=employee)

    rows = qs.values("service__id", "service__name").annotate(count=Count("id")).order_by("-count")[:limit]
    return [
        {"service_id": str(row["service__id"]), "service_name": row["service__name"], "count": row["count"]}
        for row in rows
    ]


def get_general_report(*, organization, user, date_from: date, date_to: date) -> dict:
    from apps.appointments.models import Appointment, AppointmentStatus
    from apps.customers.models import Customer
    from apps.payments.models import Payment, PaymentStatus

    with tenant_scope(organization.id):
        employee = _employee_scope(user)
        appointments_qs = Appointment.objects.filter(
            appointment_date__gte=date_from, appointment_date__lte=date_to
        )
        if employee is not None:
            appointments_qs = appointments_qs.filter(employee=employee)

        by_status = dict(appointments_qs.values_list("status").annotate(count=Count("id")))
        total = sum(by_status.values())
        cancelled = by_status.get(AppointmentStatus.CANCELLED, 0)
        no_show = by_status.get(AppointmentStatus.NO_SHOW, 0)

        report: dict = {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "appointments": {"total": total, "by_status": by_status},
            "cancellations": {
                "cancelled": cancelled,
                "no_show": no_show,
                "rate": round((cancelled + no_show) / total, 4) if total else 0,
            },
        }

        if employee is not None:
            report["productivity"] = [
                {
                    "employee_id": str(employee.id),
                    "employee_name": employee.full_name,
                    "completed": appointments_qs.filter(status=AppointmentStatus.COMPLETED).count(),
                }
            ]
        elif user.has_permission("reports:financial"):
            productivity_rows = (
                Appointment.objects.filter(
                    appointment_date__gte=date_from,
                    appointment_date__lte=date_to,
                    status=AppointmentStatus.COMPLETED,
                )
                .values("employee__id", "employee__first_name", "employee__last_name")
                .annotate(completed=Count("id"))
                .order_by("-completed")
            )
            report["productivity"] = [
                {
                    "employee_id": str(row["employee__id"]),
                    "employee_name": f"{row['employee__first_name']} {row['employee__last_name']}".strip(),
                    "completed": row["completed"],
                }
                for row in productivity_rows
            ]

        if user.has_permission("reports:financial"):
            report["customers"] = {
                "new": Customer.objects.filter(
                    registered_at__date__gte=date_from, registered_at__date__lte=date_to
                ).count()
            }
            report["revenue"] = {
                "total": Payment.objects.filter(
                    status=PaymentStatus.PAID, paid_at__date__gte=date_from, paid_at__date__lte=date_to
                ).aggregate(total=Sum("amount"))["total"]
                or Decimal("0")
            }

        return report


def get_module_report(*, organization, user, module_code: str, date_from: date, date_to: date) -> dict:
    from core import exceptions as domain_exceptions

    handlers = {
        "moto": _moto_report,
        "laboratory": _laboratory_report,
        "store": _store_report,
        "legal": _legal_report,
    }
    handler = handlers.get(module_code)
    if handler is None:
        raise domain_exceptions.ValidationError(f"Módulo '{module_code}' sin reporte disponible.")
    if not organization.has_module_active(module_code):
        raise domain_exceptions.NotFoundError("El módulo indicado no está activo para esta organización.")

    with tenant_scope(organization.id):
        return handler(user, date_from, date_to)


def _moto_report(user, date_from: date, date_to: date) -> dict:
    from apps.modules.moto.models import WorkOrder

    qs = WorkOrder.objects.filter(received_at__date__gte=date_from, received_at__date__lte=date_to)
    by_status = dict(qs.values_list("status").annotate(count=Count("id")))
    report = {"work_orders": {"total": sum(by_status.values()), "by_status": by_status}}
    if user.has_permission("reports:financial"):
        report["revenue"] = qs.filter(status="delivered").aggregate(total=Sum("total"))["total"] or Decimal(
            "0"
        )
    return report


def _laboratory_report(user, date_from: date, date_to: date) -> dict:
    from apps.modules.laboratory.models import LabTest

    qs = LabTest.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)
    by_status = dict(qs.values_list("status").annotate(count=Count("id")))
    return {"lab_tests": {"total": sum(by_status.values()), "by_status": by_status}}


def _store_report(user, date_from: date, date_to: date) -> dict:
    from apps.modules.store.models import Order

    qs = Order.objects.filter(ordered_at__date__gte=date_from, ordered_at__date__lte=date_to)
    by_status = dict(qs.values_list("status").annotate(count=Count("id")))
    report = {"orders": {"total": sum(by_status.values()), "by_status": by_status}}
    if user.has_permission("reports:financial"):
        report["revenue"] = qs.exclude(status="cancelled").aggregate(total=Sum("total"))["total"] or Decimal(
            "0"
        )
    return report


def _legal_report(user, date_from: date, date_to: date) -> dict:
    from apps.modules.legal.models import LegalCase

    qs = LegalCase.objects.filter(opened_at__gte=date_from, opened_at__lte=date_to)
    employee = _employee_scope(user)
    if employee is not None and not user.has_permission("legal:read_all"):
        qs = qs.filter(responsible_lawyer=employee)

    by_status = dict(qs.values_list("status").annotate(count=Count("id")))
    closed = qs.filter(closed_at__isnull=False)
    return {
        "cases": {"total": sum(by_status.values()), "by_status": by_status},
        "closed_count": closed.count(),
    }
