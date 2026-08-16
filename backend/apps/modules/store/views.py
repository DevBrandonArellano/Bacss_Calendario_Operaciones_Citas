from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from apps.modules.store.models import Inventory, Order, Product, ProductLaunch, ProductVariant
from apps.modules.store.serializers import (
    CreateOrderSerializer,
    InventorySerializer,
    OrderSerializer,
    ProductLaunchSerializer,
    ProductSerializer,
    ProductVariantSerializer,
    TransitionOrderSerializer,
)
from apps.modules.store.services import (
    CreateOrderRequest,
    CreateOrderUseCase,
    OrderItemSpec,
    TransitionOrderUseCase,
)
from core.permissions import HasPermission, ModuleActiveRequired

MODULE_CODE = "store"


class ModuleScopedViewSet(ModelViewSet):
    """Vistas CRUD simples del módulo: mismo criterio de permisos en todas
    (`store:write` para mutar, `store:read` para leer), como `Motorcycle`
    en Fase 8."""

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [module_check, HasPermission("store:write")]
        return [module_check, HasPermission("store:read")]


class ProductViewSet(ModuleScopedViewSet):
    serializer_class = ProductSerializer
    queryset = Product.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "category": ["exact"]}
    ordering_fields = ["name", "price"]
    ordering = ["name"]

    def get_queryset(self):
        return Product.objects.all()


class ProductVariantViewSet(ModuleScopedViewSet):
    serializer_class = ProductVariantSerializer
    queryset = ProductVariant.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"product": ["exact"]}
    ordering_fields = ["sku"]
    ordering = ["sku"]

    def get_queryset(self):
        return ProductVariant.objects.all()


class InventoryViewSet(ModuleScopedViewSet):
    serializer_class = InventorySerializer
    queryset = Inventory.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"branch": ["exact"], "product_variant": ["exact"]}

    def get_queryset(self):
        return Inventory.objects.all()


class ProductLaunchViewSet(ModuleScopedViewSet):
    serializer_class = ProductLaunchSerializer
    queryset = ProductLaunch.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["launch_at"]
    ordering = ["-launch_at"]

    def get_queryset(self):
        return ProductLaunch.objects.all()


class OrderViewSet(CreateModelMixin, RetrieveModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = OrderSerializer
    queryset = Order.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "customer": ["exact"]}
    ordering_fields = ["ordered_at"]
    ordering = ["-ordered_at"]

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action in ("create", "transition"):
            return [module_check, HasPermission("store:write")]
        return [module_check, HasPermission("store:read")]

    def get_queryset(self):
        return Order.objects.prefetch_related("items").all()

    def create(self, request, *args, **kwargs):
        payload = CreateOrderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CreateOrderUseCase(organization=request.user.organization, actor_user=request.user)
        order = use_case.execute(
            CreateOrderRequest(
                customer_id=str(data["customer_id"]),
                branch_id=str(data["branch_id"]),
                items=[
                    OrderItemSpec(
                        product_variant_id=str(item["product_variant_id"]), quantity=item["quantity"]
                    )
                    for item in data["items"]
                ],
            )
        )
        return Response(OrderSerializer(order).data, status=201)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        order = self.get_object()
        payload = TransitionOrderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        use_case = TransitionOrderUseCase(actor_user=request.user)
        use_case.execute(order, payload.validated_data["status"])
        return Response(OrderSerializer(order).data)
