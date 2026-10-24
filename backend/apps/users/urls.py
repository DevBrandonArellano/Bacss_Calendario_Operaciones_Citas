from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.users.views import MeView, RoleListView, UserViewSet

router = DefaultRouter()
router.register("", UserViewSet, basename="user")

urlpatterns = [
    path("me/", MeView.as_view(), name="user-me"),
    path("roles/", RoleListView.as_view(), name="role-list"),
    *router.urls,
]
