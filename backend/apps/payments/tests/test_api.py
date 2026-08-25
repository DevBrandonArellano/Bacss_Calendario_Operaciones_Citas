import pytest
from django.urls import reverse
from rest_framework import status

from apps.appointments.models import PaymentStatus as AppointmentPaymentStatus
from apps.payments.models import Payment, PaymentMethod, PaymentStatus

pytestmark = pytest.mark.django_db


class TestCreatePaymentApi:
    def test_registra_un_pago_completo_via_api(self, auth_client, organization, customer, appointment):
        response = auth_client.post(
            reverse("payment-list"),
            {
                "customer_id": str(customer.id),
                "appointment_id": str(appointment.id),
                "amount": "50.00",
                "method": PaymentMethod.CASH,
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        payment = Payment.all_objects.get(id=response.data["id"])
        assert payment.organization_id == organization.id
        assert payment.status == PaymentStatus.PAID
        appointment.refresh_from_db()
        assert appointment.payment_status == AppointmentPaymentStatus.PAID

    def test_monto_invalido_devuelve_400(self, auth_client, customer):
        response = auth_client.post(
            reverse("payment-list"),
            {"customer_id": str(customer.id), "amount": "-1.00", "method": PaymentMethod.CASH},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_requiere_autenticacion(self, api_client, customer):
        response = api_client.post(
            reverse("payment-list"),
            {"customer_id": str(customer.id), "amount": "10.00", "method": PaymentMethod.CASH},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestRefundPaymentApi:
    def test_reembolsa_un_pago_via_api(self, auth_client, organization, customer, appointment):
        create_response = auth_client.post(
            reverse("payment-list"),
            {
                "customer_id": str(customer.id),
                "appointment_id": str(appointment.id),
                "amount": "50.00",
                "method": PaymentMethod.CARD,
            },
            format="json",
        )
        payment_id = create_response.data["id"]

        response = auth_client.post(
            reverse("payment-refund", args=[payment_id]), {"reason": "Cliente canceló"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == PaymentStatus.REFUNDED

    def test_no_puede_reembolsar_un_pago_de_otra_organizacion(
        self, auth_client, other_organization, other_org_user
    ):
        from apps.customers.models import Customer

        other_customer = Customer.all_objects.create(
            organization=other_organization, first_name="Otra", last_name="Empresa"
        )
        payment = Payment.all_objects.create(
            organization=other_organization,
            customer=other_customer,
            amount="10.00",
            method=PaymentMethod.CASH,
        )

        response = auth_client.post(reverse("payment-refund", args=[payment.id]), {})

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.fixture
def other_org_user(other_organization, system_roles, make_user):
    return make_user(other_organization, "otro@laboratorioabc.test", roles=["org_admin"])
