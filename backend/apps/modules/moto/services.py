"""Casos de uso del módulo Taller de motos (docs/roadmap.md, Fase 8).

Las órdenes de trabajo son el único recurso con máquina de estados de
este módulo (motos e historial de vehículo son CRUD simple, gestionado
directamente en las vistas — igual que clientes/servicios en el core).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.modules.moto.models import Motorcycle, WorkOrder, WorkOrderItem, WorkOrderStatus
from core import events
from core import exceptions as domain_exceptions
from core.context import tenant_scope


def _recompute_work_order_total(work_order: WorkOrder) -> None:
    total = sum((item.subtotal for item in work_order.items.all()), Decimal("0"))
    if work_order.total != total:
        work_order.total = total
        work_order.save(update_fields=["total", "updated_at"])


@dataclass(frozen=True)
class CreateWorkOrderRequest:
    motorcycle_id: str
    appointment_id: str | None = None
    diagnosis_notes: str = ""


class CreateWorkOrderUseCase:
    def __init__(self, *, organization, actor_user=None):
        self.organization = organization
        self.actor_user = actor_user

    def execute(self, request: CreateWorkOrderRequest) -> WorkOrder:
        with tenant_scope(self.organization.id):
            return self._execute(request)

    def _execute(self, request: CreateWorkOrderRequest) -> WorkOrder:
        motorcycle = Motorcycle.objects.filter(id=request.motorcycle_id).first()
        if motorcycle is None:
            raise domain_exceptions.NotFoundError("La moto indicada no existe.")

        appointment = None
        if request.appointment_id is not None:
            from apps.appointments.models import Appointment

            appointment = Appointment.objects.filter(id=request.appointment_id).first()
            if appointment is None:
                raise domain_exceptions.NotFoundError("La cita indicada no existe.")

        work_order = WorkOrder.objects.create(
            organization=self.organization,
            motorcycle=motorcycle,
            appointment=appointment,
            diagnosis_notes=request.diagnosis_notes,
        )
        self._audit_create(work_order)
        events.emit("work_order.created", work_order=work_order)
        return work_order

    def _audit_create(self, work_order: WorkOrder) -> None:
        from apps.audit.models import AuditAction
        from apps.audit.services import log_action

        log_action(
            action=AuditAction.CREATE,
            entity_type="WorkOrder",
            entity_id=str(work_order.id),
            organization=work_order.organization,
            user=self.actor_user,
            changes={"status": work_order.status, "motorcycle_id": str(work_order.motorcycle_id)},
        )


class TransitionWorkOrderUseCase:
    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, work_order: WorkOrder, new_status: str) -> WorkOrder:
        with tenant_scope(work_order.organization_id):
            return self._execute(work_order, new_status)

    def _execute(self, work_order: WorkOrder, new_status: str) -> WorkOrder:
        if not work_order.can_transition_to(new_status):
            raise domain_exceptions.ConflictError(
                f"No se puede pasar de '{work_order.status}' a '{new_status}'.",
                details={"from": work_order.status, "to": new_status},
            )

        previous_status = work_order.status
        work_order.status = new_status
        update_fields = ["status", "updated_at"]
        if new_status == WorkOrderStatus.DELIVERED:
            work_order.delivered_at = timezone.now()
            update_fields.append("delivered_at")
        work_order.save(update_fields=update_fields)

        self._audit(work_order, previous_status, new_status)
        events.emit(f"work_order.{new_status}", work_order=work_order)
        return work_order

    def _audit(self, work_order: WorkOrder, previous_status: str, new_status: str) -> None:
        from apps.audit.models import AuditAction
        from apps.audit.services import log_action

        log_action(
            action=AuditAction.UPDATE,
            entity_type="WorkOrder",
            entity_id=str(work_order.id),
            organization=work_order.organization,
            user=self.actor_user,
            changes={"status": {"from": previous_status, "to": new_status}},
        )


@dataclass(frozen=True)
class AddWorkOrderItemRequest:
    item_type: str
    description: str
    quantity: int
    unit_price: Decimal


class AddWorkOrderItemUseCase:
    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, work_order: WorkOrder, request: AddWorkOrderItemRequest) -> WorkOrderItem:
        with tenant_scope(work_order.organization_id):
            return self._execute(work_order, request)

    def _execute(self, work_order: WorkOrder, request: AddWorkOrderItemRequest) -> WorkOrderItem:
        if work_order.status == WorkOrderStatus.DELIVERED:
            raise domain_exceptions.ConflictError("No se pueden agregar ítems a una orden ya entregada.")

        with transaction.atomic():
            item = WorkOrderItem.objects.create(
                organization=work_order.organization,
                work_order=work_order,
                item_type=request.item_type,
                description=request.description,
                quantity=request.quantity,
                unit_price=request.unit_price,
            )
            _recompute_work_order_total(work_order)
        return item
