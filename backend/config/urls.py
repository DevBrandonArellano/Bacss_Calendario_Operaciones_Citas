from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/organizations/", include("apps.organizations.urls")),
    path("api/branches/", include("apps.branches.urls")),
    path("api/users/", include("apps.users.urls")),
    path("api/audit-logs/", include("apps.audit.urls")),
    path("api/customers/", include("apps.customers.urls")),
    path("api/services/", include("apps.services.urls")),
    path("api/employees/", include("apps.services.employee_urls")),
    path("api/schedules/", include("apps.scheduling.urls")),
    path("api/availability-blocks/", include("apps.scheduling.block_urls")),
    path("api/availability/", include("apps.scheduling.availability_urls")),
    path("api/appointments/", include("apps.appointments.urls")),
    path("api/payments/", include("apps.payments.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/modules/moto/", include("apps.modules.moto.urls")),
    path("api/modules/laboratory/", include("apps.modules.laboratory.urls")),
    path("api/modules/store/", include("apps.modules.store.urls")),
    path("api/modules/legal/", include("apps.modules.legal.urls")),
    path("api/documents/", include("apps.documents.urls")),
    path("api/tasks/", include("apps.tasks.urls")),
    path("api/search/", include("apps.search.urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
