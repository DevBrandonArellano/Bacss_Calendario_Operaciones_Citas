from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.appointments.models import Appointment, AppointmentStatus
from apps.appointments.serializers import (
    AppointmentSerializer,
    CancelAppointmentSerializer,
    CreateAppointmentSerializer,
    RescheduleAppointmentSerializer,
)
from apps.appointments.services import (
    CreateAppointmentRequest,
    CreateAppointmentUseCase,
    TransitionAppointmentUseCase,
)
from core.permissions import HasPermission


class AppointmentViewSet(CreateModelMixin, RetrieveModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = AppointmentSerializer
    queryset = Appointment.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {
        "status": ["exact"],
        "branch": ["exact"],
        "employee": ["exact"],
        "customer": ["exact"],
        "appointment_date": ["exact", "gte", "lte"],
    }
    ordering_fields = ["appointment_date", "start_time"]
    ordering = ["appointment_date", "start_time"]

    def get_permissions(self):
        if self.action in (
            "create",
            "confirm",
            "cancel",
            "reschedule",
            "start",
            "complete",
            "mark_no_show",
        ):
            return [HasPermission("appointments:write")]
        return [HasPermission("appointments:read")]

    def get_queryset(self):
        return Appointment.objects.all()

    def create(self, request, *args, **kwargs):
        payload = CreateAppointmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CreateAppointmentUseCase(organization=request.user.organization)
        appointment = use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(data["customer_id"]),
                service_id=str(data["service_id"]),
                employee_id=str(data["employee_id"]),
                branch_id=str(data["branch_id"]),
                appointment_date=data["appointment_date"],
                start_time=data["start_time"],
                notes=data.get("notes", ""),
                booking_channel=data.get("booking_channel", "staff"),
                requires_confirmation=data.get("requires_confirmation", False),
            )
        )
        return Response(AppointmentSerializer(appointment).data, status=201)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        return self._transition(request, pk, AppointmentStatus.CONFIRMED)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._transition(request, pk, AppointmentStatus.IN_PROGRESS)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._transition(request, pk, AppointmentStatus.COMPLETED)

    @action(detail=True, methods=["post"], url_path="no-show")
    def mark_no_show(self, request, pk=None):
        return self._transition(request, pk, AppointmentStatus.NO_SHOW)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        payload = CancelAppointmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self._transition(
            request, pk, AppointmentStatus.CANCELLED, reason=payload.validated_data.get("reason", "")
        )

    @action(detail=True, methods=["post"])
    def reschedule(self, request, pk=None):
        appointment = self.get_object()
        payload = RescheduleAppointmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        use_case = TransitionAppointmentUseCase(actor_user=request.user)
        new_appointment = use_case.reschedule(
            appointment,
            new_date=payload.validated_data["appointment_date"],
            new_start_time=payload.validated_data["start_time"],
        )
        return Response(AppointmentSerializer(new_appointment).data)

    def _transition(self, request, pk, new_status, *, reason: str = ""):
        appointment = self.get_object()
        use_case = TransitionAppointmentUseCase(actor_user=request.user)
        use_case.transition(appointment, new_status, reason=reason)
        return Response(AppointmentSerializer(appointment).data)
