import pytest

from apps.payments.models import Payment, PaymentMethod, PaymentStatus

pytestmark = pytest.mark.django_db


class TestPayment:
    def test_valores_por_defecto(self, organization, customer):
        payment = Payment.objects.all_objects.create(
            organization=organization, customer=customer, amount="10.00", method=PaymentMethod.CASH
        )
        assert payment.status == PaymentStatus.PAID
        assert payment.appointment is None
        assert payment.refunded_at is None

    def test_permite_vincular_a_una_cita(self, organization, customer, appointment):
        payment = Payment.objects.all_objects.create(
            organization=organization,
            customer=customer,
            appointment=appointment,
            amount="25.00",
            method=PaymentMethod.CARD,
        )
        assert payment.appointment_id == appointment.id
