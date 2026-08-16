from rest_framework.routers import DefaultRouter

from apps.scheduling.views import ScheduleViewSet

router = DefaultRouter()
router.register("", ScheduleViewSet, basename="schedule")

urlpatterns = router.urls
