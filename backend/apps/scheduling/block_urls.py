from rest_framework.routers import DefaultRouter

from apps.scheduling.views import AvailabilityBlockViewSet

router = DefaultRouter()
router.register("", AvailabilityBlockViewSet, basename="availability-block")

urlpatterns = router.urls
