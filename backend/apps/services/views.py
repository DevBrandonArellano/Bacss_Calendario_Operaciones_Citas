from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.services.filters import EmployeeFilter, ServiceFilter
from apps.services.models import Employee, Service
from apps.services.serializers import (
    EmployeeSerializer,
    EmployeeServiceAssignmentSerializer,
    ServiceSerializer,
)
from core.permissions import HasPermission


class ServiceViewSet(ModelViewSet):
    serializer_class = ServiceSerializer
    queryset = Service.objects.all()
    filterset_class = ServiceFilter
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["name", "price", "duration_minutes"]
    ordering = ["name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasPermission("services:write")]
        return [HasPermission("services:read")]

    def get_queryset(self):
        return Service.objects.all()


class EmployeeViewSet(ModelViewSet):
    serializer_class = EmployeeSerializer
    queryset = Employee.objects.all()
    filterset_class = EmployeeFilter
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["last_name", "first_name"]
    ordering = ["last_name", "first_name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "set_services"):
            return [HasPermission("employees:write")]
        return [HasPermission("employees:read")]

    def get_queryset(self):
        return Employee.objects.all()

    @action(detail=True, methods=["post"], url_path="services")
    def set_services(self, request, pk=None):
        """Reemplaza el conjunto de servicios que el empleado puede prestar."""
        employee = self.get_object()
        serializer = EmployeeServiceAssignmentSerializer(
            data=request.data, context={"request": request, "employee": employee}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(EmployeeSerializer(employee).data)
