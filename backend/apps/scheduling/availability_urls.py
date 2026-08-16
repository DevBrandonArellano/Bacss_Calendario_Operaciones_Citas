from django.urls import path

from apps.scheduling.views import AvailabilityView

urlpatterns = [
    path("", AvailabilityView.as_view(), name="availability"),
]
