from datetime import date, datetime, timedelta

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reports import services
from core import exceptions as domain_exceptions
from core.permissions import HasPermission


def _parse_date(value: str | None, default: date) -> date:
    if not value:
        return default
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise domain_exceptions.ValidationError(f"Fecha inválida: '{value}' (formato esperado YYYY-MM-DD).") from exc


def _date_range(request, default_days: int = 30) -> tuple[date, date]:
    today = date.today()
    date_from = _parse_date(request.query_params.get("date_from"), today - timedelta(days=default_days))
    date_to = _parse_date(request.query_params.get("date_to"), today)
    return date_from, date_to


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("reports:read")]

    def get(self, request):
        summary = services.get_dashboard_summary(organization=request.user.organization, user=request.user)
        return Response(summary)


class ChartDataView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("reports:read")]

    def get(self, request):
        metric = request.query_params.get("metric", "")
        group_by = request.query_params.get("group_by", "day")
        date_from, date_to = _date_range(request)

        data = services.get_chart_data(
            organization=request.user.organization,
            user=request.user,
            metric=metric,
            group_by=group_by,
            date_from=date_from,
            date_to=date_to,
        )
        return Response({"metric": metric, "group_by": group_by, "data": data})


class GeneralReportView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("reports:read")]

    def get(self, request):
        date_from, date_to = _date_range(request)
        report = services.get_general_report(
            organization=request.user.organization, user=request.user, date_from=date_from, date_to=date_to
        )
        return Response(report)


class ModuleReportView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("reports:read")]

    def get(self, request, module_code: str):
        date_from, date_to = _date_range(request)
        report = services.get_module_report(
            organization=request.user.organization,
            user=request.user,
            module_code=module_code,
            date_from=date_from,
            date_to=date_to,
        )
        return Response(report)
