import pytest

from apps.modules.store.models import Order, OrderStatus
from apps.modules.store.services import (
    CreateOrderRequest,
    CreateOrderUseCase,
    OrderItemSpec,
    TransitionOrderUseCase,
)
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


class TestCreateOrder:
    def test_crea_pedido_y_descuenta_stock(self, organization, customer, branch, variant):
        use_case = CreateOrderUseCase(organization=organization)
        order = use_case.execute(
            CreateOrderRequest(
                customer_id=str(customer.id),
                branch_id=str(branch.id),
                items=[OrderItemSpec(product_variant_id=str(variant.id), quantity=4)],
            )
        )

        variant.refresh_from_db()
        assert variant.stock == 6
        assert order.total == 80  # 4 × 20.00 (precio del producto, sin override)
        assert order.items.count() == 1

    def test_stock_insuficiente_lanza_conflict_error(self, organization, customer, branch, variant):
        use_case = CreateOrderUseCase(organization=organization)
        with pytest.raises(domain_exceptions.ConflictError):
            use_case.execute(
                CreateOrderRequest(
                    customer_id=str(customer.id),
                    branch_id=str(branch.id),
                    items=[OrderItemSpec(product_variant_id=str(variant.id), quantity=999)],
                )
            )
        variant.refresh_from_db()
        assert variant.stock == 10  # sin cambios: la validación es previa a la escritura

    def test_suma_cantidades_de_la_misma_variante_antes_de_validar_stock(
        self, organization, customer, branch, variant
    ):
        # 6 + 6 = 12 > 10 disponibles: debe fallar aunque cada línea individual quepa.
        use_case = CreateOrderUseCase(organization=organization)
        with pytest.raises(domain_exceptions.ConflictError):
            use_case.execute(
                CreateOrderRequest(
                    customer_id=str(customer.id),
                    branch_id=str(branch.id),
                    items=[
                        OrderItemSpec(product_variant_id=str(variant.id), quantity=6),
                        OrderItemSpec(product_variant_id=str(variant.id), quantity=6),
                    ],
                )
            )

    def test_sin_items_lanza_validation_error(self, organization, customer, branch):
        use_case = CreateOrderUseCase(organization=organization)
        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                CreateOrderRequest(customer_id=str(customer.id), branch_id=str(branch.id), items=[])
            )


class TestTransitionOrder:
    def test_cancelar_antes_de_entrega_restituye_stock(self, organization, customer, branch, variant):
        order = CreateOrderUseCase(organization=organization).execute(
            CreateOrderRequest(
                customer_id=str(customer.id),
                branch_id=str(branch.id),
                items=[OrderItemSpec(product_variant_id=str(variant.id), quantity=4)],
            )
        )
        variant.refresh_from_db()
        assert variant.stock == 6

        TransitionOrderUseCase().execute(order, OrderStatus.CANCELLED)

        variant.refresh_from_db()
        assert variant.stock == 10

    def test_transicion_invalida_lanza_conflict_error(self, organization, customer, branch):
        order = Order.objects.all_objects.create(organization=organization, customer=customer, branch=branch)
        with pytest.raises(domain_exceptions.ConflictError):
            TransitionOrderUseCase().execute(order, OrderStatus.DELIVERED)

    def test_entregar_no_restituye_stock(self, organization, customer, branch, variant):
        order = CreateOrderUseCase(organization=organization).execute(
            CreateOrderRequest(
                customer_id=str(customer.id),
                branch_id=str(branch.id),
                items=[OrderItemSpec(product_variant_id=str(variant.id), quantity=4)],
            )
        )
        for status in [
            OrderStatus.CONFIRMED,
            OrderStatus.PAID,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.DELIVERED,
        ]:
            TransitionOrderUseCase().execute(order, status)

        variant.refresh_from_db()
        assert variant.stock == 6
