import pytest
from django.db import IntegrityError

from apps.modules.store.models import OrderItem, ProductVariant

pytestmark = pytest.mark.django_db


class TestProductVariant:
    def test_sku_unico_por_organizacion(self, organization, product):
        ProductVariant.all_objects.create(organization=organization, product=product, sku="DUP")
        with pytest.raises(IntegrityError):
            ProductVariant.all_objects.create(organization=organization, product=product, sku="DUP")

    def test_effective_price_usa_price_override_si_existe(self, organization, product):
        variant = ProductVariant.all_objects.create(
            organization=organization, product=product, sku="X", price_override="15.00"
        )
        assert variant.effective_price == "15.00"

    def test_effective_price_cae_al_precio_del_producto_sin_override(self, organization, product):
        variant = ProductVariant.all_objects.create(
            organization=organization, product=product, sku="Y"
        )
        assert variant.effective_price == product.price


class TestOrderTransitions:
    @pytest.mark.parametrize(
        "current,target,expected",
        [
            ("pending", "confirmed", True),
            ("pending", "cancelled", True),
            ("pending", "paid", False),
            ("confirmed", "paid", True),
            ("paid", "preparing", True),
            ("preparing", "ready", True),
            ("ready", "delivered", True),
            ("ready", "cancelled", False),
            ("delivered", "pending", False),
            ("cancelled", "pending", False),
        ],
    )
    def test_tabla_de_decision_transiciones(self, organization, customer, branch, current, target, expected):
        from apps.modules.store.models import Order

        order = Order.all_objects.create(
            organization=organization, customer=customer, branch=branch, status=current
        )
        assert order.can_transition_to(target) is expected


class TestOrderItem:
    def test_subtotal_se_calcula_en_save(self, organization, customer, branch, variant):
        from apps.modules.store.models import Order

        order = Order.all_objects.create(organization=organization, customer=customer, branch=branch)
        item = OrderItem.all_objects.create(
            organization=organization,
            order=order,
            product_variant=variant,
            quantity=3,
            unit_price="10.00",
        )
        assert item.subtotal == 30
