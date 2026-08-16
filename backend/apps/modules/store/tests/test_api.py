import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.modules.store.models import Order, Product

pytestmark = pytest.mark.django_db


@pytest.fixture
def reception_client(api_client, organization, system_roles, make_user):
    user = make_user(organization, "recepcion@motorsecuador.test", roles=["reception"])
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


class TestModuloInactivo:
    def test_listar_productos_sin_modulo_activo_devuelve_404(self, auth_client):
        response = auth_client.get(reverse("product-list"))
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestAccesoPorRol:
    def test_recepcion_si_tiene_acceso_al_modulo(self, reception_client, store_active):
        # A diferencia de laboratorio, Tienda no es un módulo con datos
        # clínicos sensibles: Recepción sí puede vender (docs/auth-rbac.md
        # no lo restringe, mismo criterio que el módulo Taller).
        response = reception_client.get(reverse("product-list"))
        assert response.status_code == status.HTTP_200_OK


class TestProductApi:
    def test_crea_un_producto(self, auth_client, store_active, organization):
        response = auth_client.post(
            reverse("product-list"), {"sku": "CAM-002", "name": "Gorra", "price": "12.00"}
        )
        assert response.status_code == status.HTTP_201_CREATED
        created = Product.objects.all_objects.get(id=response.data["id"])
        assert created.organization_id == organization.id

    def test_aislamiento_por_tenant(self, auth_client, store_active, other_organization):
        Product.objects.all_objects.create(
            organization=other_organization, sku="OTRO-1", name="Producto ajeno", price="5.00"
        )

        response = auth_client.get(reverse("product-list"))

        assert response.status_code == status.HTTP_200_OK
        skus = [item["sku"] for item in response.data["results"]]
        assert "OTRO-1" not in skus


class TestOrderPipelineApi:
    def test_flujo_completo_via_api(self, auth_client, store_active, organization, customer, branch, variant):
        create_response = auth_client.post(
            reverse("store-order-list"),
            {
                "customer_id": str(customer.id),
                "branch_id": str(branch.id),
                "items": [{"product_variant_id": str(variant.id), "quantity": 2}],
            },
            format="json",
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        order_id = create_response.data["id"]
        assert create_response.data["total"] == "40.00"

        variant.refresh_from_db()
        assert variant.stock == 8

        confirm_response = auth_client.post(
            reverse("store-order-transition", args=[order_id]), {"status": "confirmed"}
        )
        assert confirm_response.status_code == status.HTTP_200_OK
        assert confirm_response.data["status"] == "confirmed"

        cancel_response = auth_client.post(
            reverse("store-order-transition", args=[order_id]), {"status": "cancelled"}
        )
        assert cancel_response.status_code == status.HTTP_200_OK

        variant.refresh_from_db()
        assert variant.stock == 10  # restituido al cancelar

        order = Order.objects.all_objects.get(id=order_id)
        assert order.status == "cancelled"

    def test_stock_insuficiente_devuelve_409(self, auth_client, store_active, customer, branch, variant):
        response = auth_client.post(
            reverse("store-order-list"),
            {
                "customer_id": str(customer.id),
                "branch_id": str(branch.id),
                "items": [{"product_variant_id": str(variant.id), "quantity": 999}],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_transicion_invalida_devuelve_409(self, auth_client, store_active, organization, customer, branch):
        order = Order.objects.all_objects.create(organization=organization, customer=customer, branch=branch)
        response = auth_client.post(reverse("store-order-transition", args=[order.id]), {"status": "delivered"})
        assert response.status_code == status.HTTP_409_CONFLICT
