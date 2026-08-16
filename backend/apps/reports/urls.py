from django.urls import path

from apps.reports.views import ChartDataView, DashboardView, GeneralReportView, ModuleReportView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="reports-dashboard"),
    path("charts/", ChartDataView.as_view(), name="reports-charts"),
    path("summary/", GeneralReportView.as_view(), name="reports-summary"),
    path("modules/<str:module_code>/", ModuleReportView.as_view(), name="reports-module"),
]
