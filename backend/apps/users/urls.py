from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.users.views import RoleListView, UserViewSet

router = DefaultRouter()
router.register("", UserViewSet, basename="user")

urlpatterns = [
    path("roles/", RoleListView.as_view(), name="role-list"),
    *router.urls,
]
