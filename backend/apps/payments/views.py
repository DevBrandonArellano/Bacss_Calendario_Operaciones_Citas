from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.payments.models import Payment
from apps.payments.serializers import CreatePaymentSerializer, PaymentSerializer, RefundPaymentSerializer
from apps.payments.services import CreatePaymentRequest, CreatePaymentUseCase, RefundPaymentUseCase
from core.permissions import HasPermission


class PaymentViewSet(CreateModelMixin, RetrieveModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related("customer", "appointment").all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {
        "status": ["exact"],
        "customer": ["exact"],
        "appointment": ["exact"],
        "method": ["exact"],
    }
    ordering_fields = ["created_at", "amount"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ("create", "refund"):
            return [HasPermission("payments:write")]
        return [HasPermission("payments:read")]

    def get_queryset(self):
        return Payment.objects.select_related("customer", "appointment").all()

    def create(self, request, *args, **kwargs):
        payload = CreatePaymentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CreatePaymentUseCase(organization=request.user.organization, actor_user=request.user)
        payment = use_case.execute(
            CreatePaymentRequest(
                customer_id=str(data["customer_id"]),
                appointment_id=str(data["appointment_id"]) if data.get("appointment_id") else None,
                amount=data["amount"],
                method=data["method"],
                notes=data.get("notes", ""),
            )
        )
        return Response(PaymentSerializer(payment).data, status=201)

    @action(detail=True, methods=["post"])
    def refund(self, request, pk=None):
        payment = self.get_object()
        payload = RefundPaymentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        use_case = RefundPaymentUseCase(actor_user=request.user)
        use_case.execute(payment, reason=payload.validated_data.get("reason", ""))
        return Response(PaymentSerializer(payment).data)
