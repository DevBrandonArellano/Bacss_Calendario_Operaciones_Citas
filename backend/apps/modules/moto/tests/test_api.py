import pytest
from django.urls import reverse
from rest_framework import status

from apps.modules.moto.models import Motorcycle, WorkOrder, WorkOrderItemType, WorkOrderStatus

pytestmark = pytest.mark.django_db


class TestModuloInactivo:
    """Sin `ModuleActivation(module_code='moto')`, toda ruta del módulo
    responde 404, no 403 (docs/module-system.md)."""

    def test_listar_motos_sin_modulo_activo_devuelve_404(self, auth_client):
        response = auth_client.get(reverse("motorcycle-list"))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_crear_moto_sin_modulo_activo_devuelve_404(self, auth_client, customer):
        response = auth_client.post(
            reverse("motorcycle-list"),
            {"customer": str(customer.id), "plate": "AAA-111", "brand": "Suzuki", "model": "GN125"},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_listar_ordenes_sin_modulo_activo_devuelve_404(self, auth_client):
        response = auth_client.get(reverse("work-order-list"))
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestMotorcycleApi:
    def test_crea_una_moto(self, auth_client, moto_active, organization, customer):
        response = auth_client.post(
            reverse("motorcycle-list"),
            {"customer": str(customer.id), "plate": "AAA-111", "brand": "Suzuki", "model": "GN125"},
        )

        assert response.status_code == status.HTTP_201_CREATED
        motorcycle = Motorcycle.objects.all_objects.get(id=response.data["id"])
        assert motorcycle.organization_id == organization.id

    def test_aislamiento_por_tenant(self, auth_client, moto_active, other_organization):
        from apps.customers.models import Customer

        other_customer = Customer.objects.all_objects.create(
            organization=other_organization, first_name="Otro", last_name="Cliente"
        )
        Motorcycle.objects.all_objects.create(
            organization=other_organization,
            customer=other_customer,
            plate="ZZZ-999",
            brand="BMW",
            model="F800",
        )

        response = auth_client.get(reverse("motorcycle-list"))

        assert response.status_code == status.HTTP_200_OK
        plates = [item["plate"] for item in response.data["results"]]
        assert "ZZZ-999" not in plates

    def test_registra_historial_vehicular(self, auth_client, moto_active, motorcycle):
        response = auth_client.post(
            reverse("motorcycle-history", args=[motorcycle.id]),
            {"service_date": "2026-01-01", "mileage": 5000, "service_description": "Cambio de aceite"},
        )
        assert response.status_code == status.HTTP_201_CREATED

        list_response = auth_client.get(reverse("motorcycle-history", args=[motorcycle.id]))
        assert list_response.status_code == status.HTTP_200_OK
        assert len(list_response.data["results"]) == 1


class TestWorkOrderApi:
    def test_crea_orden_de_trabajo(self, auth_client, moto_active, motorcycle):
        response = auth_client.post(reverse("work-order-list"), {"motorcycle_id": str(motorcycle.id)})

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["status"] == WorkOrderStatus.RECEIVED

    def test_transicion_via_api(self, auth_client, moto_active, organization, motorcycle):
        work_order = WorkOrder.objects.all_objects.create(organization=organization, motorcycle=motorcycle)

        response = auth_client.post(
            reverse("work-order-transition", args=[work_order.id]), {"status": WorkOrderStatus.DIAGNOSIS}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == WorkOrderStatus.DIAGNOSIS

    def test_transicion_invalida_devuelve_409(self, auth_client, moto_active, organization, motorcycle):
        work_order = WorkOrder.objects.all_objects.create(organization=organization, motorcycle=motorcycle)

        response = auth_client.post(
            reverse("work-order-transition", args=[work_order.id]), {"status": WorkOrderStatus.DELIVERED}
        )

        assert response.status_code == status.HTTP_409_CONFLICT

    def test_agrega_item_y_recalcula_total(self, auth_client, moto_active, organization, motorcycle):
        work_order = WorkOrder.objects.all_objects.create(organization=organization, motorcycle=motorcycle)

        response = auth_client.post(
            reverse("work-order-items", args=[work_order.id]),
            {
                "item_type": WorkOrderItemType.PART,
                "description": "Filtro",
                "quantity": 2,
                "unit_price": "7.50",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        work_order.refresh_from_db()
        assert work_order.total == 15
