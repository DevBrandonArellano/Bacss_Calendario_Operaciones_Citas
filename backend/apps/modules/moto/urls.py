from rest_framework.routers import DefaultRouter

from apps.modules.moto.views import MotorcycleViewSet, WorkOrderViewSet

router = DefaultRouter()
router.register("motorcycles", MotorcycleViewSet, basename="motorcycle")
router.register("work-orders", WorkOrderViewSet, basename="work-order")

urlpatterns = router.urls
