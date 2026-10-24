from decimal import Decimal

import pytest

from apps.modules.moto.models import WorkOrder, WorkOrderItemType, WorkOrderStatus
from apps.modules.moto.services import (
    AddWorkOrderItemRequest,
    AddWorkOrderItemUseCase,
    CreateWorkOrderRequest,
    CreateWorkOrderUseCase,
    TransitionWorkOrderUseCase,
)
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


class TestCreateWorkOrder:
    def test_crea_orden_en_estado_recibida(self, organization, motorcycle):
        use_case = CreateWorkOrderUseCase(organization=organization)
        work_order = use_case.execute(CreateWorkOrderRequest(motorcycle_id=str(motorcycle.id)))

        assert work_order.status == WorkOrderStatus.RECEIVED
        assert work_order.total == 0

    def test_moto_inexistente_lanza_not_found(self, organization):
        use_case = CreateWorkOrderUseCase(organization=organization)

        with pytest.raises(domain_exceptions.NotFoundError):
            use_case.execute(CreateWorkOrderRequest(motorcycle_id="00000000-0000-0000-0000-000000000000"))


class TestTransitionWorkOrder:
    def test_transicion_valida_actualiza_estado(self, organization, motorcycle):
        work_order = WorkOrder.all_objects.create(organization=organization, motorcycle=motorcycle)
        use_case = TransitionWorkOrderUseCase()

        updated = use_case.execute(work_order, WorkOrderStatus.DIAGNOSIS)

        assert updated.status == WorkOrderStatus.DIAGNOSIS

    def test_transicion_a_entregada_registra_fecha(self, organization, motorcycle):
        work_order = WorkOrder.all_objects.create(
            organization=organization, motorcycle=motorcycle, status=WorkOrderStatus.FINISHED
        )
        use_case = TransitionWorkOrderUseCase()

        updated = use_case.execute(work_order, WorkOrderStatus.DELIVERED)

        assert updated.delivered_at is not None

    def test_transicion_invalida_lanza_conflict(self, organization, motorcycle):
        work_order = WorkOrder.all_objects.create(organization=organization, motorcycle=motorcycle)
        use_case = TransitionWorkOrderUseCase()

        with pytest.raises(domain_exceptions.ConflictError):
            use_case.execute(work_order, WorkOrderStatus.DELIVERED)


class TestAddWorkOrderItem:
    def test_agregar_items_recalcula_total(self, organization, motorcycle):
        work_order = WorkOrder.all_objects.create(organization=organization, motorcycle=motorcycle)
        use_case = AddWorkOrderItemUseCase()

        use_case.execute(
            work_order,
            AddWorkOrderItemRequest(
                item_type=WorkOrderItemType.PART,
                description="Pastillas de freno",
                quantity=1,
                unit_price=Decimal("15.00"),
            ),
        )
        use_case.execute(
            work_order,
            AddWorkOrderItemRequest(
                item_type=WorkOrderItemType.LABOR,
                description="Mano de obra",
                quantity=1,
                unit_price=Decimal("10.00"),
            ),
        )

        work_order.refresh_from_db()
        assert work_order.total == Decimal("25.00")

    def test_no_permite_agregar_items_a_orden_entregada(self, organization, motorcycle):
        work_order = WorkOrder.all_objects.create(
            organization=organization, motorcycle=motorcycle, status=WorkOrderStatus.DELIVERED
        )
        use_case = AddWorkOrderItemUseCase()

        with pytest.raises(domain_exceptions.ConflictError):
            use_case.execute(
                work_order,
                AddWorkOrderItemRequest(
                    item_type=WorkOrderItemType.PART,
                    description="Repuesto",
                    quantity=1,
                    unit_price=Decimal("5.00"),
                ),
            )
