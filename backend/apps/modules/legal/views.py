from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin, UpdateModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from apps.modules.legal.models import CaseEvent, CaseTask, Hearing, LegalCase
from apps.modules.legal.serializers import (
    CaseEventSerializer,
    CaseTaskSerializer,
    CreateLegalCaseSerializer,
    HearingSerializer,
    LegalCaseSerializer,
    TransitionLegalCaseSerializer,
)
from apps.modules.legal.services import (
    CreateLegalCaseRequest,
    CreateLegalCaseUseCase,
    TransitionLegalCaseUseCase,
)
from core.permissions import HasPermission, ModuleActiveRequired

MODULE_CODE = "legal"


def can_read_all_cases(user) -> bool:
    """Admin (y superadmin) ven todos los casos; un profesional sin este
    permiso solo ve los suyos (`docs/auth-rbac.md`: "RU casos asignados")."""

    return bool(getattr(user, "is_platform_superadmin", False) or user.has_permission("legal:read_all"))


class LegalCaseViewSet(
    CreateModelMixin, RetrieveModelMixin, ListModelMixin, UpdateModelMixin, GenericViewSet
):
    serializer_class = LegalCaseSerializer
    queryset = LegalCase.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "responsible_lawyer": ["exact"]}
    ordering_fields = ["opened_at"]
    ordering = ["-opened_at"]

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action in ("create", "update", "partial_update", "transition") or self._is_write_events():
            return [module_check, HasPermission("legal:write")]
        return [module_check, HasPermission("legal:read")]

    def _is_write_events(self) -> bool:
        return self.action == "events" and self.request.method == "POST"

    def get_queryset(self):
        qs = LegalCase.objects.all()
        user = self.request.user
        if can_read_all_cases(user):
            return qs
        employee = getattr(user, "employee_profile", None)
        if employee is None:
            return qs.none()
        return qs.filter(responsible_lawyer=employee)

    def create(self, request, *args, **kwargs):
        payload = CreateLegalCaseSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CreateLegalCaseUseCase(organization=request.user.organization, actor_user=request.user)
        legal_case = use_case.execute(
            CreateLegalCaseRequest(
                case_number=data["case_number"],
                customer_id=str(data["customer_id"]),
                case_type=data["case_type"],
                responsible_lawyer_id=str(data["responsible_lawyer_id"]),
                priority=data["priority"],
                description=data.get("description", ""),
            )
        )
        return Response(LegalCaseSerializer(legal_case).data, status=201)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        legal_case = self.get_object()
        payload = TransitionLegalCaseSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        use_case = TransitionLegalCaseUseCase(actor_user=request.user)
        use_case.execute(legal_case, payload.validated_data["status"])
        return Response(LegalCaseSerializer(legal_case).data)

    @action(detail=True, methods=["get", "post"])
    def events(self, request, pk=None):
        legal_case = self.get_object()
        if request.method == "POST":
            serializer = CaseEventSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            event = CaseEvent.objects.create(
                organization=request.user.organization,
                legal_case=legal_case,
                created_by_user=request.user,
                **serializer.validated_data,
            )
            return Response(CaseEventSerializer(event).data, status=201)

        events_qs = CaseEvent.objects.filter(legal_case=legal_case)
        page = self.paginate_queryset(events_qs)
        serializer = CaseEventSerializer(page if page is not None else events_qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


class CaseScopedViewSet(ModelViewSet):
    """CRUD simple con el mismo alcance por caso asignado que `LegalCase`
    (Audiencias y Tareas heredan la sensibilidad del caso al que pertenecen)."""

    case_field = "legal_case"

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [module_check, HasPermission("legal:write")]
        return [module_check, HasPermission("legal:read")]

    def base_queryset(self):
        raise NotImplementedError

    def get_queryset(self):
        qs = self.base_queryset()
        user = self.request.user
        if can_read_all_cases(user):
            return qs
        employee = getattr(user, "employee_profile", None)
        if employee is None:
            return qs.none()
        return qs.filter(**{f"{self.case_field}__responsible_lawyer": employee})


class HearingViewSet(CaseScopedViewSet):
    serializer_class = HearingSerializer
    queryset = Hearing.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"legal_case": ["exact"], "status": ["exact"]}
    ordering_fields = ["scheduled_at"]
    ordering = ["scheduled_at"]

    def base_queryset(self):
        return Hearing.objects.all()


class CaseTaskViewSet(CaseScopedViewSet):
    serializer_class = CaseTaskSerializer
    queryset = CaseTask.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"legal_case": ["exact"], "status": ["exact"]}
    ordering_fields = ["due_date"]
    ordering = ["due_date"]

    def base_queryset(self):
        return CaseTask.objects.all()
