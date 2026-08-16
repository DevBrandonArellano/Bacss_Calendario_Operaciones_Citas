from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import (
    CreateModelMixin,
    DestroyModelMixin,
    ListModelMixin,
    RetrieveModelMixin,
    UpdateModelMixin,
)
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.tasks.models import Task
from apps.tasks.serializers import CreateTaskSerializer, TaskSerializer
from core.owner_access import check_owner_permission


class TaskViewSet(
    CreateModelMixin, RetrieveModelMixin, ListModelMixin, UpdateModelMixin, DestroyModelMixin, GenericViewSet
):
    """Sin `ModuleActiveRequired`: transversal, igual que `Document`."""

    serializer_class = TaskSerializer
    queryset = Task.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "owner_type": ["exact"]}
    ordering_fields = ["due_date"]

    def get_queryset(self):
        owner_type = self.request.query_params.get("owner_type")
        owner_id = self.request.query_params.get("owner_id")
        if self.action == "list":
            if owner_type and owner_id:
                check_owner_permission(self.request.user, owner_type, owner_id, write=False)
                return Task.objects.filter(owner_type=owner_type, owner_id=owner_id)
            # Sin filtro de propietario: bandeja personal de tareas asignadas.
            return Task.objects.filter(assigned_to_user=self.request.user)
        return Task.objects.all()

    def create(self, request, *args, **kwargs):
        payload = CreateTaskSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        check_owner_permission(request.user, data["owner_type"], str(data["owner_id"]), write=True)

        task = Task.objects.create(
            organization=request.user.organization,
            owner_type=data["owner_type"],
            owner_id=data["owner_id"],
            title=data["title"],
            description=data.get("description", ""),
            assigned_to_user_id=data.get("assigned_to_user_id"),
            due_date=data.get("due_date"),
            priority=data.get("priority", "medium"),
        )
        return Response(TaskSerializer(task).data, status=201)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        check_owner_permission(request.user, instance.owner_type, instance.owner_id, write=False)
        return Response(TaskSerializer(instance).data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        check_owner_permission(request.user, instance.owner_type, instance.owner_id, write=True)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        check_owner_permission(request.user, instance.owner_type, instance.owner_id, write=True)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        check_owner_permission(request.user, instance.owner_type, instance.owner_id, write=True)
        return super().destroy(request, *args, **kwargs)
