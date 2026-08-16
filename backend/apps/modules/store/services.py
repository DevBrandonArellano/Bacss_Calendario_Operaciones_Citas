"""Casos de uso del módulo Tienda / lanzamientos (docs/roadmap.md, Fase 10).

El único agregado con máquina de estados es `Order`. La creación reserva
stock de cada `ProductVariant` referenciada (control de stock, requisito
de la Fase 10); cancelar un pedido antes de la entrega restituye ese stock
(`STOCK_RESERVED_STATUSES`, `apps/modules/store/models.py`).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction

from apps.modules.store.models import (
    Order,
    OrderItem,
    OrderStatus,
    ProductVariant,
    STOCK_RESERVED_STATUSES,
)
from core import events
from core import exceptions as domain_exceptions
from core.context import tenant_scope


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
class OrderItemSpec:
    product_variant_id: str
    quantity: int


@dataclass(frozen=True)
class CreateOrderRequest:
    customer_id: str
    branch_id: str
    items: list[OrderItemSpec]


class CreateOrderUseCase:
    def __init__(self, *, organization, actor_user=None):
        self.organization = organization
        self.actor_user = actor_user

    def execute(self, request: CreateOrderRequest) -> Order:
        with tenant_scope(self.organization.id):
            return self._execute(request)

    def _execute(self, request: CreateOrderRequest) -> Order:
        from apps.audit.models import AuditAction
        from apps.branches.models import Branch
        from apps.customers.models import Customer

        if not request.items:
            raise domain_exceptions.ValidationError("El pedido debe incluir al menos un ítem.")

        customer = Customer.objects.filter(id=request.customer_id).first()
        if customer is None:
            raise domain_exceptions.NotFoundError("El cliente indicado no existe.")

        branch = Branch.objects.filter(id=request.branch_id).first()
        if branch is None:
            raise domain_exceptions.NotFoundError("La sucursal indicada no existe.")

        variants: dict[str, ProductVariant] = {}
        for spec in request.items:
            variant = variants.get(spec.product_variant_id) or ProductVariant.objects.filter(
                id=spec.product_variant_id
            ).first()
            if variant is None:
                raise domain_exceptions.NotFoundError(
                    f"La variante {spec.product_variant_id} no existe."
                )
            variants[spec.product_variant_id] = variant

        # Suma cantidades por variante repetida antes de validar stock, para
        # no dejar pasar un pedido con la misma variante en dos líneas que
        # individualmente entran en stock pero juntas no.
        requested_quantity: dict[str, int] = {}
        for spec in request.items:
            requested_quantity[spec.product_variant_id] = (
                requested_quantity.get(spec.product_variant_id, 0) + spec.quantity
            )
        for variant_id, quantity in requested_quantity.items():
            variant = variants[variant_id]
            if variant.stock < quantity:
                raise domain_exceptions.ConflictError(
                    f"Stock insuficiente para '{variant.sku}': disponible {variant.stock}, solicitado {quantity}."
                )

        with transaction.atomic():
            order = Order.objects.create(
                organization=self.organization, customer=customer, branch=branch
            )
            total = Decimal("0")
            for spec in request.items:
                variant = variants[spec.product_variant_id]
                item = OrderItem.objects.create(
                    organization=self.organization,
                    order=order,
                    product_variant=variant,
                    quantity=spec.quantity,
                    unit_price=variant.effective_price,
                )
                total += item.subtotal
                variant.stock -= spec.quantity
                variant.save(update_fields=["stock", "updated_at"])
            order.total = total
            order.save(update_fields=["total", "updated_at"])

        _audit(
            action=AuditAction.CREATE,
            entity_type="Order",
            entity_id=str(order.id),
            organization=self.organization,
            actor_user=self.actor_user,
            changes={"customer_id": str(customer.id), "item_count": len(request.items)},
        )
        events.emit("order.created", order=order)
        return order


class TransitionOrderUseCase:
    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, order: Order, new_status: str) -> Order:
        with tenant_scope(order.organization_id):
            return self._execute(order, new_status)

    def _execute(self, order: Order, new_status: str) -> Order:
        from apps.audit.models import AuditAction

        if not order.can_transition_to(new_status):
            raise domain_exceptions.ConflictError(
                f"No se puede pasar de '{order.status}' a '{new_status}'.",
                details={"from": order.status, "to": new_status},
            )

        previous_status = order.status
        with transaction.atomic():
            if new_status == OrderStatus.CANCELLED and previous_status in STOCK_RESERVED_STATUSES:
                for item in order.items.select_related("product_variant"):
                    variant = item.product_variant
                    variant.stock += item.quantity
                    variant.save(update_fields=["stock", "updated_at"])

            order.status = new_status
            order.save(update_fields=["status", "updated_at"])

        _audit(
            action=AuditAction.UPDATE,
            entity_type="Order",
            entity_id=str(order.id),
            organization=order.organization,
            actor_user=self.actor_user,
            changes={"status": {"from": previous_status, "to": new_status}},
        )
        events.emit(f"order.{new_status}", order=order)
        return order
