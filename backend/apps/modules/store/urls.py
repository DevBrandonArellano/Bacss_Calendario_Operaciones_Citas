from rest_framework.routers import DefaultRouter

from apps.modules.store.views import (
    InventoryViewSet,
    OrderViewSet,
    ProductLaunchViewSet,
    ProductVariantViewSet,
    ProductViewSet,
)

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("product-variants", ProductVariantViewSet, basename="product-variant")
router.register("inventory", InventoryViewSet, basename="inventory")
router.register("launches", ProductLaunchViewSet, basename="product-launch")
router.register("orders", OrderViewSet, basename="store-order")

urlpatterns = router.urls
