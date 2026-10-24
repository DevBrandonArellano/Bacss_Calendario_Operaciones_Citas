import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.models import AuditAction, AuditLog
from apps.documents.models import Document

pytestmark = pytest.mark.django_db


@pytest.fixture
def reception_client(api_client, organization, system_roles, make_user):
    user = make_user(organization, "recepcion@motorsecuador.test", roles=["reception"])
    token = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return api_client


def _upload_payload(customer, filename="contrato.pdf"):
    return {
        "owner_type": "customer",
        "owner_id": str(customer.id),
        "name": "Contrato firmado",
        "file": SimpleUploadedFile(filename, b"contenido de prueba", content_type="application/pdf"),
    }


class TestUploadDocument:
    def test_sube_un_documento_y_audita_la_creacion(self, auth_client, organization, customer):
        response = auth_client.post(reverse("document-list"), _upload_payload(customer), format="multipart")

        assert response.status_code == status.HTTP_201_CREATED
        document = Document.all_objects.get(id=response.data["id"])
        assert document.organization_id == organization.id
        assert document.size_bytes > 0
        # all_objects: igual que Document arriba, la lectura corre fuera del
        # contexto de tenant de la request ya finalizada.
        assert AuditLog.all_objects.filter(action=AuditAction.CREATE, entity_type="Document").exists()

    def test_recepcion_no_puede_subir_documento_de_un_caso_legal(
        self, reception_client, organization, customer
    ):
        payload = {
            "owner_type": "case",
            "owner_id": str(customer.id),  # id arbitrario, la autorización falla antes de resolverlo
            "name": "Escrito",
            "file": SimpleUploadedFile("escrito.pdf", b"x", content_type="application/pdf"),
        }
        response = reception_client.post(reverse("document-list"), payload, format="multipart")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_tipo_de_propietario_no_soportado_devuelve_400(self, auth_client, customer):
        payload = {
            "owner_type": "unknown_type",
            "owner_id": str(customer.id),
            "name": "X",
            "file": SimpleUploadedFile("x.pdf", b"x"),
        }
        response = auth_client.post(reverse("document-list"), payload, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestListDocuments:
    def test_requiere_owner_type_y_owner_id(self, auth_client):
        response = auth_client.get(reverse("document-list"))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_lista_solo_los_documentos_del_propietario_indicado(self, auth_client, organization, customer):
        auth_client.post(reverse("document-list"), _upload_payload(customer), format="multipart")

        response = auth_client.get(
            reverse("document-list"), {"owner_type": "customer", "owner_id": str(customer.id)}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1


class TestDownloadDocument:
    def test_descargar_queda_auditado(self, auth_client, organization, customer):
        upload_response = auth_client.post(
            reverse("document-list"), _upload_payload(customer), format="multipart"
        )
        document_id = upload_response.data["id"]

        response = auth_client.get(reverse("document-download", args=[document_id]))

        assert response.status_code == status.HTTP_200_OK
        assert AuditLog.all_objects.filter(
            action=AuditAction.DOWNLOAD, entity_type="Document", entity_id=document_id
        ).exists()


class TestTenantIsolation:
    def test_no_se_puede_acceder_a_un_documento_de_otra_organizacion(
        self, auth_client, organization, other_organization, customer
    ):
        from apps.customers.models import Customer

        other_customer = Customer.all_objects.create(
            organization=other_organization, first_name="Ajeno", last_name="Ajeno"
        )
        other_document = Document.all_objects.create(
            organization=other_organization,
            owner_type="customer",
            owner_id=other_customer.id,
            name="Doc ajeno",
            file=SimpleUploadedFile("ajeno.pdf", b"x"),
            size_bytes=1,
        )

        response = auth_client.get(reverse("document-detail", args=[other_document.id]))

        assert response.status_code == status.HTTP_404_NOT_FOUND
