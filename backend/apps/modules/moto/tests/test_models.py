import pytest
from django.db import IntegrityError

from apps.modules.moto.models import (
    Motorcycle,
    VehicleHistory,
    WorkOrder,
    WorkOrderItem,
    WorkOrderItemType,
    WorkOrderStatus,
)

pytestmark = pytest.mark.django_db


class TestMotorcycle:
    def test_placa_unica_por_organizacion(self, organization, customer):
        Motorcycle.objects.all_objects.create(
            organization=organization, customer=customer, plate="XYZ-999", brand="Honda", model="CB1"
        )
        with pytest.raises(IntegrityError):
            Motorcycle.objects.all_objects.create(
                organization=organization, customer=customer, plate="XYZ-999", brand="Honda", model="CB2"
            )


class TestVehicleHistory:
    def test_se_asocia_a_una_moto(self, organization, motorcycle):
        entry = VehicleHistory.objects.all_objects.create(
            organization=organization,
            motorcycle=motorcycle,
            service_date="2026-01-01",
            mileage=1000,
            service_description="Cambio de aceite",
        )
        assert entry.motorcycle_id == motorcycle.id


class TestWorkOrderTransitions:
    @pytest.mark.parametrize(
        ("current", "target", "expected"),
        [
            (WorkOrderStatus.RECEIVED, WorkOrderStatus.DIAGNOSIS, True),
            (WorkOrderStatus.RECEIVED, WorkOrderStatus.IN_REPAIR, False),
            (WorkOrderStatus.DIAGNOSIS, WorkOrderStatus.AWAITING_AUTHORIZATION, True),
            (WorkOrderStatus.AWAITING_AUTHORIZATION, WorkOrderStatus.IN_REPAIR, True),
            (WorkOrderStatus.IN_REPAIR, WorkOrderStatus.AWAITING_PART, True),
            (WorkOrderStatus.IN_REPAIR, WorkOrderStatus.FINISHED, True),
            (WorkOrderStatus.AWAITING_PART, WorkOrderStatus.IN_REPAIR, True),
            (WorkOrderStatus.FINISHED, WorkOrderStatus.DELIVERED, True),
            (WorkOrderStatus.DELIVERED, WorkOrderStatus.RECEIVED, False),
            (WorkOrderStatus.RECEIVED, WorkOrderStatus.DELIVERED, False),
        ],
    )
    def test_tabla_de_decision_transiciones(self, organization, motorcycle, current, target, expected):
        work_order = WorkOrder.objects.all_objects.create(
            organization=organization, motorcycle=motorcycle, status=current
        )
        assert work_order.can_transition_to(target) is expected


class TestWorkOrderItem:
    def test_calcula_subtotal_al_guardar(self, organization, motorcycle):
        work_order = WorkOrder.objects.all_objects.create(organization=organization, motorcycle=motorcycle)
        item = WorkOrderItem.objects.all_objects.create(
            organization=organization,
            work_order=work_order,
            item_type=WorkOrderItemType.PART,
            description="Filtro de aceite",
            quantity=2,
            unit_price="5.50",
        )
        assert item.subtotal == 11
