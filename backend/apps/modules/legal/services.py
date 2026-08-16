"""Casos de uso del módulo Legal (docs/roadmap.md, Fase 11).

`LegalCase` es el único agregado con máquina de estados formal (igual que
`WorkOrder`/`LabTest`/`Order` en fases previas). Cada transición deja dos
rastros distintos y complementarios: un `CaseEvent` (cronología de
dominio, visible al equipo legal) y una entrada en `AuditLog` (registro de
seguridad inmutable) — ver nota de diseño en `models.py`.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.utils import timezone

from apps.modules.legal.models import CaseEvent, LegalCase, LegalCaseStatus
from core import exceptions as domain_exceptions
from core.context import tenant_scope


def _audit(*, action: str, entity_id: str, organization, actor_user, changes: dict) -> None:
    from apps.audit.services import log_action

    log_action(
        action=action,
        entity_type="LegalCase",
        entity_id=entity_id,
        organization=organization,
        user=actor_user,
        changes=changes,
    )


@dataclass(frozen=True)
class CreateLegalCaseRequest:
    case_number: str
    customer_id: str
    case_type: str
    responsible_lawyer_id: str
    priority: str = "medium"
    description: str = ""


class CreateLegalCaseUseCase:
    def __init__(self, *, organization, actor_user=None):
        self.organization = organization
        self.actor_user = actor_user

    def execute(self, request: CreateLegalCaseRequest) -> LegalCase:
        with tenant_scope(self.organization.id):
            return self._execute(request)

    def _execute(self, request: CreateLegalCaseRequest) -> LegalCase:
        from apps.audit.models import AuditAction
        from apps.customers.models import Customer
        from apps.services.models import Employee

        customer = Customer.objects.filter(id=request.customer_id).first()
        if customer is None:
            raise domain_exceptions.NotFoundError("El cliente indicado no existe.")

        lawyer = Employee.objects.filter(id=request.responsible_lawyer_id).first()
        if lawyer is None:
            raise domain_exceptions.NotFoundError("El abogado responsable indicado no existe.")

        legal_case = LegalCase.objects.create(
            organization=self.organization,
            case_number=request.case_number,
            customer=customer,
            case_type=request.case_type,
            responsible_lawyer=lawyer,
            priority=request.priority,
            description=request.description,
        )
        CaseEvent.objects.create(
            organization=self.organization,
            legal_case=legal_case,
            event_type="case_opened",
            description=f"Caso abierto ({request.case_type}).",
            created_by_user=self.actor_user,
        )
        _audit(
            action=AuditAction.CREATE,
            entity_id=str(legal_case.id),
            organization=self.organization,
            actor_user=self.actor_user,
            changes={"case_number": legal_case.case_number, "customer_id": str(customer.id)},
        )
        return legal_case


class TransitionLegalCaseUseCase:
    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, legal_case: LegalCase, new_status: str) -> LegalCase:
        with tenant_scope(legal_case.organization_id):
            return self._execute(legal_case, new_status)

    def _execute(self, legal_case: LegalCase, new_status: str) -> LegalCase:
        from apps.audit.models import AuditAction

        if not legal_case.can_transition_to(new_status):
            raise domain_exceptions.ConflictError(
                f"No se puede pasar de '{legal_case.status}' a '{new_status}'.",
                details={"from": legal_case.status, "to": new_status},
            )

        previous_status = legal_case.status
        legal_case.status = new_status
        update_fields = ["status", "updated_at"]
        if new_status == LegalCaseStatus.CLOSED:
            legal_case.closed_at = timezone.now().date()
            update_fields.append("closed_at")
        elif previous_status == LegalCaseStatus.CLOSED and new_status == LegalCaseStatus.ACTIVE:
            # Reapertura: el caso vuelve a estar activo, ya no tiene fecha de cierre.
            legal_case.closed_at = None
            update_fields.append("closed_at")
        legal_case.save(update_fields=update_fields)

        CaseEvent.objects.create(
            organization=legal_case.organization,
            legal_case=legal_case,
            event_type="status_change",
            description=f"Estado cambiado de '{previous_status}' a '{new_status}'.",
            created_by_user=self.actor_user,
        )
        _audit(
            action=AuditAction.UPDATE,
            entity_id=str(legal_case.id),
            organization=legal_case.organization,
            actor_user=self.actor_user,
            changes={"status": {"from": previous_status, "to": new_status}},
        )
        return legal_case
