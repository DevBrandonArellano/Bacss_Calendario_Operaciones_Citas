from rest_framework.generics import GenericAPIView
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.scheduling.engine import get_available_slots
from apps.scheduling.models import AvailabilityBlock, Schedule
from apps.scheduling.serializers import (
    AvailabilityBlockSerializer,
    AvailabilityQuerySerializer,
    AvailabilitySlotSerializer,
    ScheduleSerializer,
)
from apps.services.models import Service
from core import exceptions as domain_exceptions
from core.permissions import HasPermission


class ScheduleViewSet(ModelViewSet):
    serializer_class = ScheduleSerializer
    queryset = Schedule.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("scheduling:write")]
        return [HasPermission("scheduling:read")]

    def get_queryset(self):
        return Schedule.objects.all()


class AvailabilityBlockViewSet(ModelViewSet):
    serializer_class = AvailabilityBlockSerializer
    queryset = AvailabilityBlock.objects.all()

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("scheduling:write")]
        return [HasPermission("scheduling:read")]

    def get_queryset(self):
        return AvailabilityBlock.objects.all()


class AvailabilityView(GenericAPIView):
    """Expone el motor de disponibilidad, de solo lectura (docs/availability-engine.md)."""

    permission_classes = [HasPermission("scheduling:read")]

    def get(self, request):
        query = AvailabilityQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data

        service = Service.objects.filter(id=data["service_id"]).first()
        if service is None:
            raise domain_exceptions.NotFoundError("El servicio indicado no existe.")

        employee_id = data.get("employee_id")
        slots = get_available_slots(
            organization_id=str(request.user.organization_id),
            branch_id=str(data["branch_id"]),
            service_duration_minutes=service.duration_minutes,
            target_date=data["date"],
            employee_id=str(employee_id) if employee_id else None,
        )
        slot_dicts = [
            {"employee_id": s.employee_id, "start_time": s.start_time, "end_time": s.end_time} for s in slots
        ]
        serializer = AvailabilitySlotSerializer(slot_dicts, many=True)
        return Response(
            {
                "service_id": str(data["service_id"]),
                "branch_id": str(data["branch_id"]),
                "date": str(data["date"]),
                "slots": serializer.data,
            }
        )
