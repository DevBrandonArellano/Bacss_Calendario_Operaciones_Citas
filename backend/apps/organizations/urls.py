from django.urls import path

from apps.organizations.views import MyOrganizationView

urlpatterns = [
    path("me/", MyOrganizationView.as_view(), name="organization-me"),
]
