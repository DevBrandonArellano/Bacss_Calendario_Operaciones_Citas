"""Casos de uso del módulo Laboratorio clínico (docs/roadmap.md, Fase 9).

El pipeline de una prueba (`LabTest`) tiene 7 etapas lineales
(`LAB_PROCESS_STAGE_ORDER`, `apps/modules/laboratory/models.py`). Dos
pasos llevan datos propios y casos de uso dedicados: tomar la muestra
(`CollectSampleUseCase`) y registrar/validar el resultado
(`RecordLabResultUseCase`/`ValidateLabResultUseCase` — este último es el
paso auditado por excelencia del módulo, ver docs/erd.md). El resto de
transiciones (sin datos adicionales) usan `TransitionLabTestUseCase`.

`LabOrder.status` es un agregado: la etapa de su prueba menos avanzada
(el cuello de botella), recalculado en cada transición — mismo patrón que
`Appointment.payment_status` (Fase 7) y `WorkOrder.total` (Fase 8).
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from apps.modules.laboratory.models import (
    LAB_PROCESS_STAGE_ORDER,
    LabOrder,
    LabProcessStatus,
    LabResult,
    LabTest,
    Patient,
    Sample,
    SampleStatus,
)
from core import events
from core import exceptions as domain_exceptions
from core.context import tenant_scope


def _recompute_lab_order_status(lab_order: LabOrder) -> None:
    tests = list(lab_order.tests.all())
    if not tests:
        return
    stage_indices = [LAB_PROCESS_STAGE_ORDER.index(test.status) for test in tests]
    bottleneck = LAB_PROCESS_STAGE_ORDER[min(stage_indices)]
    if lab_order.status != bottleneck:
        lab_order.status = bottleneck
        lab_order.save(update_fields=["status", "updated_at"])


def _audit(*, action: str, entity_type: str, entity_id: str, organization, actor_user, changes: dict) -> None:
    from apps.audit.services import log_action

    log_action(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        organization=organization,
        user=actor_user,
        changes=changes,
    )


@dataclass(frozen=True)
class LabTestSpec:
    test_code: str
    test_name: str


@dataclass(frozen=True)
class CreateLabOrderRequest:
    patient_id: str
    ordering_employee_id: str
    tests: list[LabTestSpec]


class CreateLabOrderUseCase:
    def __init__(self, *, organization, actor_user=None):
        self.organization = organization
        self.actor_user = actor_user

    def execute(self, request: CreateLabOrderRequest) -> LabOrder:
        with tenant_scope(self.organization.id):
            return self._execute(request)

    def _execute(self, request: CreateLabOrderRequest) -> LabOrder:
        from apps.audit.models import AuditAction
        from apps.services.models import Employee

        patient = Patient.objects.filter(id=request.patient_id).first()
        if patient is None:
            raise domain_exceptions.NotFoundError("El paciente indicado no existe.")

        ordering_employee = Employee.objects.filter(id=request.ordering_employee_id).first()
        if ordering_employee is None:
            raise domain_exceptions.NotFoundError("El profesional que solicita no existe.")

        if not request.tests:
            raise domain_exceptions.ValidationError("El pedido debe incluir al menos una prueba.")

        with transaction.atomic():
            lab_order = LabOrder.objects.create(
                organization=self.organization, patient=patient, ordering_employee=ordering_employee
            )
            for spec in request.tests:
                LabTest.objects.create(
                    organization=self.organization,
                    lab_order=lab_order,
                    test_code=spec.test_code,
                    test_name=spec.test_name,
                )

        _audit(
            action=AuditAction.CREATE,
            entity_type="LabOrder",
            entity_id=str(lab_order.id),
            organization=self.organization,
            actor_user=self.actor_user,
            changes={"patient_id": str(patient.id), "test_count": len(request.tests)},
        )
        events.emit("lab_order.created", lab_order=lab_order)
        return lab_order


class TransitionLabTestUseCase:
    """Transiciones sin datos propios: ordered→sample_pending,
    sample_taken→processing, validated→delivered."""

    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, lab_test: LabTest, new_status: str) -> LabTest:
        with tenant_scope(lab_test.organization_id):
            return self._execute(lab_test, new_status)

    def _execute(self, lab_test: LabTest, new_status: str) -> LabTest:
        from apps.audit.models import AuditAction

        if not lab_test.can_transition_to(new_status):
            raise domain_exceptions.ConflictError(
                f"No se puede pasar de '{lab_test.status}' a '{new_status}'.",
                details={"from": lab_test.status, "to": new_status},
            )
        previous_status = lab_test.status
        lab_test.status = new_status
        lab_test.save(update_fields=["status", "updated_at"])
        _recompute_lab_order_status(lab_test.lab_order)

        _audit(
            action=AuditAction.UPDATE,
            entity_type="LabTest",
            entity_id=str(lab_test.id),
            organization=lab_test.organization,
            actor_user=self.actor_user,
            changes={"status": {"from": previous_status, "to": new_status}},
        )
        events.emit(f"lab_test.{new_status}", lab_test=lab_test)
        return lab_test


@dataclass(frozen=True)
class CollectSampleRequest:
    sample_type: str
    collected_by_employee_id: str | None = None


class CollectSampleUseCase:
    """`sample_pending` → `sample_taken`: registra la muestra tomada."""

    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, lab_test: LabTest, request: CollectSampleRequest) -> Sample:
        with tenant_scope(lab_test.organization_id):
            return self._execute(lab_test, request)

    def _execute(self, lab_test: LabTest, request: CollectSampleRequest) -> Sample:
        from apps.audit.models import AuditAction
        from apps.services.models import Employee

        if lab_test.status != LabProcessStatus.SAMPLE_PENDING:
            raise domain_exceptions.ConflictError(
                "Solo se puede registrar la muestra de una prueba en estado "
                f"'{LabProcessStatus.SAMPLE_PENDING}' (actual: '{lab_test.status}')."
            )

        collected_by = None
        if request.collected_by_employee_id:
            collected_by = Employee.objects.filter(id=request.collected_by_employee_id).first()
            if collected_by is None:
                raise domain_exceptions.NotFoundError("El empleado que recolecta la muestra no existe.")

        with transaction.atomic():
            sample, _created = Sample.objects.update_or_create(
                lab_test=lab_test,
                defaults={
                    "organization": lab_test.organization,
                    "sample_type": request.sample_type,
                    "collected_at": timezone.now(),
                    "collected_by_employee": collected_by,
                    "status": SampleStatus.COLLECTED,
                },
            )
            lab_test.status = LabProcessStatus.SAMPLE_TAKEN
            lab_test.save(update_fields=["status", "updated_at"])
            _recompute_lab_order_status(lab_test.lab_order)

        _audit(
            action=AuditAction.UPDATE,
            entity_type="LabTest",
            entity_id=str(lab_test.id),
            organization=lab_test.organization,
            actor_user=self.actor_user,
            changes={
                "status": {"from": LabProcessStatus.SAMPLE_PENDING, "to": LabProcessStatus.SAMPLE_TAKEN}
            },
        )
        events.emit("lab_test.sample_taken", lab_test=lab_test)
        return sample


@dataclass(frozen=True)
class RecordLabResultRequest:
    result_value: str
    unit: str = ""
    reference_range: str = ""
    observations: str = ""


class RecordLabResultUseCase:
    """`processing` → `result_available`: registra el resultado (sin validarlo aún)."""

    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, lab_test: LabTest, request: RecordLabResultRequest) -> LabResult:
        with tenant_scope(lab_test.organization_id):
            return self._execute(lab_test, request)

    def _execute(self, lab_test: LabTest, request: RecordLabResultRequest) -> LabResult:
        from apps.audit.models import AuditAction

        if lab_test.status != LabProcessStatus.PROCESSING:
            raise domain_exceptions.ConflictError(
                "Solo se puede registrar el resultado de una prueba en estado "
                f"'{LabProcessStatus.PROCESSING}' (actual: '{lab_test.status}')."
            )

        with transaction.atomic():
            result, _created = LabResult.objects.update_or_create(
                lab_test=lab_test,
                defaults={
                    "organization": lab_test.organization,
                    "result_value": request.result_value,
                    "unit": request.unit,
                    "reference_range": request.reference_range,
                    "observations": request.observations,
                },
            )
            lab_test.status = LabProcessStatus.RESULT_AVAILABLE
            lab_test.save(update_fields=["status", "updated_at"])
            _recompute_lab_order_status(lab_test.lab_order)

        # No se registran valores clínicos en la auditoría, solo el hecho y el id (docs/logging.md).
        _audit(
            action=AuditAction.UPDATE,
            entity_type="LabTest",
            entity_id=str(lab_test.id),
            organization=lab_test.organization,
            actor_user=self.actor_user,
            changes={
                "status": {"from": LabProcessStatus.PROCESSING, "to": LabProcessStatus.RESULT_AVAILABLE}
            },
        )
        events.emit("lab_test.result_available", lab_test=lab_test)
        return result


class ValidateLabResultUseCase:
    """`result_available` → `validated`: el paso auditado por excelencia
    del módulo (docs/erd.md, docs/auth-rbac.md). Requiere que exista un
    `LabResult` registrado; queda quién y cuándo validó."""

    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, lab_test: LabTest) -> LabResult:
        with tenant_scope(lab_test.organization_id):
            return self._execute(lab_test)

    def _execute(self, lab_test: LabTest) -> LabResult:
        from apps.audit.models import AuditAction

        if lab_test.status != LabProcessStatus.RESULT_AVAILABLE:
            raise domain_exceptions.ConflictError(
                "Solo se puede validar una prueba en estado "
                f"'{LabProcessStatus.RESULT_AVAILABLE}' (actual: '{lab_test.status}')."
            )

        result = LabResult.objects.filter(lab_test=lab_test).first()
        if result is None:
            raise domain_exceptions.ConflictError("La prueba no tiene un resultado registrado todavía.")

        responsible_employee = getattr(self.actor_user, "employee_profile", None)

        with transaction.atomic():
            result.validated_by_employee = responsible_employee
            result.validated_at = timezone.now()
            result.save(update_fields=["validated_by_employee", "validated_at", "updated_at"])

            lab_test.status = LabProcessStatus.VALIDATED
            lab_test.save(update_fields=["status", "updated_at"])
            _recompute_lab_order_status(lab_test.lab_order)

        _audit(
            action=AuditAction.UPDATE,
            entity_type="LabResult",
            entity_id=str(result.id),
            organization=lab_test.organization,
            actor_user=self.actor_user,
            changes={
                "status": {"from": LabProcessStatus.RESULT_AVAILABLE, "to": LabProcessStatus.VALIDATED},
                "validated_by_employee_id": str(responsible_employee.id) if responsible_employee else None,
            },
        )
        events.emit("lab_result.validated", lab_test=lab_test, lab_result=result)
        return result
