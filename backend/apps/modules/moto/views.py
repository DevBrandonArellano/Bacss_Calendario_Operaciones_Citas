from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from apps.modules.moto.models import Motorcycle, VehicleHistory, WorkOrder
from apps.modules.moto.serializers import (
    AddWorkOrderItemSerializer,
    CreateWorkOrderSerializer,
    MotorcycleSerializer,
    TransitionWorkOrderSerializer,
    VehicleHistorySerializer,
    WorkOrderItemSerializer,
    WorkOrderSerializer,
)
from apps.modules.moto.services import (
    AddWorkOrderItemRequest,
    AddWorkOrderItemUseCase,
    CreateWorkOrderRequest,
    CreateWorkOrderUseCase,
    TransitionWorkOrderUseCase,
)
from core.permissions import HasPermission, ModuleActiveRequired

MODULE_CODE = "moto"


class MotorcycleViewSet(ModelViewSet):
    serializer_class = MotorcycleSerializer
    queryset = Motorcycle.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"customer": ["exact"]}
    ordering_fields = ["plate", "brand", "model"]
    ordering = ["plate"]

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action in ("create", "update", "partial_update", "destroy", "history"):
            return [module_check, HasPermission("moto:write" if self._is_write_history() else "moto:read")]
        return [module_check, HasPermission("moto:read")]

    def _is_write_history(self) -> bool:
        return self.action == "history" and self.request.method == "POST"

    def get_queryset(self):
        return Motorcycle.objects.all()

    @action(detail=True, methods=["get", "post"])
    def history(self, request, pk=None):
        motorcycle = self.get_object()
        if request.method == "POST":
            serializer = VehicleHistorySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            entry = VehicleHistory.objects.create(
                organization=request.user.organization,
                motorcycle=motorcycle,
                **serializer.validated_data,
            )
            return Response(VehicleHistorySerializer(entry).data, status=201)

        entries = VehicleHistory.objects.filter(motorcycle=motorcycle)
        page = self.paginate_queryset(entries)
        serializer = VehicleHistorySerializer(page if page is not None else entries, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class WorkOrderViewSet(CreateModelMixin, RetrieveModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = WorkOrderSerializer
    queryset = WorkOrder.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "motorcycle": ["exact"]}
    ordering_fields = ["received_at"]
    ordering = ["-received_at"]

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action in ("create", "transition") or self._is_write_items():
            return [module_check, HasPermission("moto:write")]
        return [module_check, HasPermission("moto:read")]

    def _is_write_items(self) -> bool:
        return self.action == "items" and self.request.method == "POST"

    def get_queryset(self):
        return WorkOrder.objects.prefetch_related("items").all()

    def create(self, request, *args, **kwargs):
        payload = CreateWorkOrderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CreateWorkOrderUseCase(organization=request.user.organization, actor_user=request.user)
        work_order = use_case.execute(
            CreateWorkOrderRequest(
                motorcycle_id=str(data["motorcycle_id"]),
                appointment_id=str(data["appointment_id"]) if data.get("appointment_id") else None,
                diagnosis_notes=data.get("diagnosis_notes", ""),
            )
        )
        return Response(WorkOrderSerializer(work_order).data, status=201)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        work_order = self.get_object()
        payload = TransitionWorkOrderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        use_case = TransitionWorkOrderUseCase(actor_user=request.user)
        use_case.execute(work_order, payload.validated_data["status"])
        return Response(WorkOrderSerializer(work_order).data)

    @action(detail=True, methods=["get", "post"], url_path="items")
    def items(self, request, pk=None):
        work_order = self.get_object()
        if request.method == "POST":
            payload = AddWorkOrderItemSerializer(data=request.data)
            payload.is_valid(raise_exception=True)
            use_case = AddWorkOrderItemUseCase(actor_user=request.user)
            item = use_case.execute(work_order, AddWorkOrderItemRequest(**payload.validated_data))
            return Response(WorkOrderItemSerializer(item).data, status=201)

        return Response(WorkOrderItemSerializer(work_order.items.all(), many=True).data)
