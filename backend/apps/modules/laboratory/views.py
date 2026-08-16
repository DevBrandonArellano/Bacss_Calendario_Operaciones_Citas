from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.mixins import CreateModelMixin, ListModelMixin, RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet, ModelViewSet

from apps.modules.laboratory.models import LabOrder, LabResult, LabTest, Patient, Sample
from apps.modules.laboratory.serializers import (
    CollectSampleSerializer,
    CreateLabOrderSerializer,
    LabOrderSerializer,
    LabResultSerializer,
    LabTestSerializer,
    PatientSerializer,
    RecordLabResultSerializer,
    SampleSerializer,
    TransitionLabTestSerializer,
)
from apps.modules.laboratory.services import (
    CollectSampleRequest,
    CollectSampleUseCase,
    CreateLabOrderRequest,
    CreateLabOrderUseCase,
    LabTestSpec,
    RecordLabResultRequest,
    RecordLabResultUseCase,
    TransitionLabTestUseCase,
    ValidateLabResultUseCase,
)
from core.permissions import HasPermission, ModuleActiveRequired

MODULE_CODE = "laboratory"


class PatientViewSet(ModelViewSet):
    serializer_class = PatientSerializer
    queryset = Patient.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"document_number": ["exact"]}
    ordering_fields = ["last_name", "first_name"]
    ordering = ["last_name", "first_name"]

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [module_check, HasPermission("laboratory:write")]
        return [module_check, HasPermission("laboratory:read")]

    def get_queryset(self):
        return Patient.objects.all()


class LabOrderViewSet(CreateModelMixin, RetrieveModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = LabOrderSerializer
    queryset = LabOrder.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "patient": ["exact"]}
    ordering_fields = ["ordered_at"]
    ordering = ["-ordered_at"]

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action == "create":
            return [module_check, HasPermission("laboratory:write")]
        return [module_check, HasPermission("laboratory:read")]

    def get_queryset(self):
        return LabOrder.objects.prefetch_related("tests", "tests__sample", "tests__result").all()

    def create(self, request, *args, **kwargs):
        payload = CreateLabOrderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CreateLabOrderUseCase(organization=request.user.organization, actor_user=request.user)
        lab_order = use_case.execute(
            CreateLabOrderRequest(
                patient_id=str(data["patient_id"]),
                ordering_employee_id=str(data["ordering_employee_id"]),
                tests=[LabTestSpec(**spec) for spec in data["tests"]],
            )
        )
        return Response(LabOrderSerializer(lab_order).data, status=201)


class LabTestViewSet(RetrieveModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = LabTestSerializer
    queryset = LabTest.objects.all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {"status": ["exact"], "lab_order": ["exact"]}

    def get_permissions(self):
        module_check = ModuleActiveRequired(MODULE_CODE)
        if self.action == "validate":
            return [module_check, HasPermission("lab_results:write")]
        if self.action in ("transition", "collect_sample", "record_result"):
            return [module_check, HasPermission("laboratory:write")]
        return [module_check, HasPermission("laboratory:read")]

    def get_queryset(self):
        return LabTest.objects.select_related("sample", "result").all()

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        lab_test = self.get_object()
        payload = TransitionLabTestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        use_case = TransitionLabTestUseCase(actor_user=request.user)
        use_case.execute(lab_test, payload.validated_data["status"])
        return Response(LabTestSerializer(lab_test).data)

    @action(detail=True, methods=["post"], url_path="collect-sample")
    def collect_sample(self, request, pk=None):
        lab_test = self.get_object()
        payload = CollectSampleSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = CollectSampleUseCase(actor_user=request.user)
        use_case.execute(
            lab_test,
            CollectSampleRequest(
                sample_type=data["sample_type"],
                collected_by_employee_id=(
                    str(data["collected_by_employee_id"]) if data.get("collected_by_employee_id") else None
                ),
            ),
        )
        return Response(LabTestSerializer(lab_test).data)

    @action(detail=True, methods=["post"], url_path="record-result")
    def record_result(self, request, pk=None):
        lab_test = self.get_object()
        payload = RecordLabResultSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        use_case = RecordLabResultUseCase(actor_user=request.user)
        use_case.execute(
            lab_test,
            RecordLabResultRequest(
                result_value=data["result_value"],
                unit=data.get("unit", ""),
                reference_range=data.get("reference_range", ""),
                observations=data.get("observations", ""),
            ),
        )
        return Response(LabTestSerializer(lab_test).data)

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        lab_test = self.get_object()
        use_case = ValidateLabResultUseCase(actor_user=request.user)
        use_case.execute(lab_test)
        return Response(LabTestSerializer(lab_test).data)


class SampleViewSet(RetrieveModelMixin, ListModelMixin, GenericViewSet):
    serializer_class = SampleSerializer
    queryset = Sample.objects.all()

    def get_permissions(self):
        return [ModuleActiveRequired(MODULE_CODE), HasPermission("laboratory:read")]

    def get_queryset(self):
        return Sample.objects.all()


class LabResultViewSet(RetrieveModelMixin, ListModelMixin, GenericViewSet):
    """Dato clínico sensible: todo acceso de lectura queda auditado
    (docs/erd.md), no solo la escritura/validación."""

    serializer_class = LabResultSerializer
    queryset = LabResult.objects.all()

    def get_permissions(self):
        return [ModuleActiveRequired(MODULE_CODE), HasPermission("lab_results:read")]

    def get_queryset(self):
        return LabResult.objects.all()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._audit_read(request, entity_id=str(instance.id))
        return Response(self.get_serializer(instance).data)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        self._audit_read(request, entity_id="")
        return response

    def _audit_read(self, request, *, entity_id: str) -> None:
        from apps.audit.models import AuditAction
        from apps.audit.services import log_action

        log_action(
            action=AuditAction.READ,
            entity_type="LabResult",
            entity_id=entity_id,
            organization=request.user.organization,
            user=request.user,
        )
