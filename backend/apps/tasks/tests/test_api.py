import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.tasks.models import Task

pytestmark = pytest.mark.django_db


@pytest.fixture
def reception_client(api_client, organization, system_roles, make_user):
    user = make_user(organization, "recepcion@motorsecuador.test", roles=["reception"])
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


class TestCreateTask:
    def test_crea_tarea_asociada_a_un_cliente(self, auth_client, organization, customer):
        response = auth_client.post(
            reverse("task-list"),
            {"owner_type": "customer", "owner_id": str(customer.id), "title": "Llamar para confirmar"},
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED
        task = Task.all_objects.get(id=response.data["id"])
        assert task.organization_id == organization.id
        assert task.status == "pending"

    def test_recepcion_no_puede_crear_tarea_de_caso_legal(self, reception_client, customer):
        response = reception_client.post(
            reverse("task-list"),
            {"owner_type": "case", "owner_id": str(customer.id), "title": "Preparar escrito"},
            format="json",
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestListTasks:
    def test_lista_tareas_del_propietario_indicado(self, auth_client, customer):
        auth_client.post(
            reverse("task-list"),
            {"owner_type": "customer", "owner_id": str(customer.id), "title": "Tarea 1"},
            format="json",
        )

        response = auth_client.get(
            reverse("task-list"), {"owner_type": "customer", "owner_id": str(customer.id)}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1

    def test_sin_filtro_devuelve_bandeja_personal(self, auth_client, org_admin_user, customer):
        Task.all_objects.create(
            organization=org_admin_user.organization,
            owner_type="customer",
            owner_id=customer.id,
            title="Asignada a mí",
            assigned_to_user=org_admin_user,
        )
        Task.all_objects.create(
            organization=org_admin_user.organization,
            owner_type="customer",
            owner_id=customer.id,
            title="Sin asignar",
        )

        response = auth_client.get(reverse("task-list"))

        assert response.status_code == status.HTTP_200_OK
        titles = [item["title"] for item in response.data["results"]]
        assert titles == ["Asignada a mí"]


class TestUpdateTask:
    def test_marcar_tarea_como_completada(self, auth_client, organization, customer):
        create_response = auth_client.post(
            reverse("task-list"),
            {"owner_type": "customer", "owner_id": str(customer.id), "title": "Tarea"},
            format="json",
        )
        task_id = create_response.data["id"]

        response = auth_client.patch(
            reverse("task-detail", args=[task_id]), {"status": "completed"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == "completed"

    def test_no_permite_reasignar_el_propietario_desde_update(self, auth_client, customer):
        create_response = auth_client.post(
            reverse("task-list"),
            {"owner_type": "customer", "owner_id": str(customer.id), "title": "Tarea"},
            format="json",
        )
        task_id = create_response.data["id"]

        response = auth_client.patch(
            reverse("task-detail", args=[task_id]), {"owner_type": "order"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["owner_type"] == "customer"  # el campo es read_only, se ignora silenciosamente
