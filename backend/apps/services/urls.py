from rest_framework.routers import DefaultRouter

from apps.services.views import ServiceViewSet

router = DefaultRouter()
router.register("", ServiceViewSet, basename="service")

urlpatterns = router.urls
