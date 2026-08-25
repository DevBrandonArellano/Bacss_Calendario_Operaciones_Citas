"""Tests del motor de pagos (docs/roadmap.md, Fase 7).

Cubre pago completo, pago parcial (varias transacciones sobre la misma
cita), reembolso, y las validaciones del caso de uso. Ninguno de estos
tests fija el contexto de tenant manualmente: `CreatePaymentUseCase` y
`RefundPaymentUseCase` deben resolverlo ellos mismos (ver
`core.context.tenant_scope` y el hallazgo previo a esta fase).
"""

from decimal import Decimal

import pytest

from apps.appointments.models import PaymentStatus as AppointmentPaymentStatus
from apps.payments.models import Payment, PaymentMethod, PaymentStatus
from apps.payments.services import CreatePaymentRequest, CreatePaymentUseCase, RefundPaymentUseCase
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


class TestRegistrarPago:
    def test_pago_completo_marca_la_cita_como_pagada(self, organization, customer, appointment):
        use_case = CreatePaymentUseCase(organization=organization)

        payment = use_case.execute(
            CreatePaymentRequest(
                customer_id=str(customer.id),
                appointment_id=str(appointment.id),
                amount=Decimal("50.00"),
                method=PaymentMethod.CARD,
            )
        )

        assert payment.status == PaymentStatus.PAID
        assert payment.paid_at is not None
        appointment.refresh_from_db()
        assert appointment.payment_status == AppointmentPaymentStatus.PAID

    def test_pago_parcial_marca_la_cita_como_parcial(self, organization, customer, appointment):
        use_case = CreatePaymentUseCase(organization=organization)

        use_case.execute(
            CreatePaymentRequest(
                customer_id=str(customer.id),
                appointment_id=str(appointment.id),
                amount=Decimal("20.00"),
                method=PaymentMethod.CASH,
            )
        )

        appointment.refresh_from_db()
        assert appointment.payment_status == AppointmentPaymentStatus.PARTIAL

    def test_dos_pagos_parciales_que_completan_el_precio_marcan_pagada(
        self, organization, customer, appointment
    ):
        use_case = CreatePaymentUseCase(organization=organization)

        use_case.execute(
            CreatePaymentRequest(
                customer_id=str(customer.id),
                appointment_id=str(appointment.id),
                amount=Decimal("20.00"),
                method=PaymentMethod.CASH,
            )
        )
        use_case.execute(
            CreatePaymentRequest(
                customer_id=str(customer.id),
                appointment_id=str(appointment.id),
                amount=Decimal("30.00"),
                method=PaymentMethod.CARD,
            )
        )

        appointment.refresh_from_db()
        assert appointment.payment_status == AppointmentPaymentStatus.PAID
        assert Payment.all_objects.filter(appointment=appointment).count() == 2

    def test_pago_sin_cita_no_requiere_cita(self, organization, customer):
        use_case = CreatePaymentUseCase(organization=organization)

        payment = use_case.execute(
            CreatePaymentRequest(
                customer_id=str(customer.id), amount=Decimal("15.00"), method=PaymentMethod.TRANSFER
            )
        )

        assert payment.appointment is None

    def test_cliente_inexistente_lanza_not_found(self, organization):
        use_case = CreatePaymentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.NotFoundError):
            use_case.execute(
                CreatePaymentRequest(
                    customer_id="00000000-0000-0000-0000-000000000000",
                    amount=Decimal("10.00"),
                    method=PaymentMethod.CASH,
                )
            )

    def test_cita_de_otro_cliente_lanza_validation_error(self, organization, customer, appointment):
        from apps.customers.models import Customer

        otro_cliente = Customer.all_objects.create(
            organization=organization, first_name="Otro", last_name="Cliente"
        )
        use_case = CreatePaymentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                CreatePaymentRequest(
                    customer_id=str(otro_cliente.id),
                    appointment_id=str(appointment.id),
                    amount=Decimal("10.00"),
                    method=PaymentMethod.CASH,
                )
            )

    @pytest.mark.parametrize("amount", [Decimal("0"), Decimal("-5.00")])
    def test_monto_no_positivo_lanza_validation_error(self, organization, customer, amount):
        use_case = CreatePaymentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                CreatePaymentRequest(customer_id=str(customer.id), amount=amount, method=PaymentMethod.CASH)
            )


class TestReembolsarPago:
    def test_reembolso_marca_el_pago_y_recalcula_la_cita(self, organization, customer, appointment):
        create_use_case = CreatePaymentUseCase(organization=organization)
        payment = create_use_case.execute(
            CreatePaymentRequest(
                customer_id=str(customer.id),
                appointment_id=str(appointment.id),
                amount=Decimal("50.00"),
                method=PaymentMethod.CARD,
            )
        )
        appointment.refresh_from_db()
        assert appointment.payment_status == AppointmentPaymentStatus.PAID

        refund_use_case = RefundPaymentUseCase()
        refunded = refund_use_case.execute(payment, reason="Cliente canceló")

        assert refunded.status == PaymentStatus.REFUNDED
        assert refunded.refunded_at is not None
        appointment.refresh_from_db()
        assert appointment.payment_status == AppointmentPaymentStatus.REFUNDED

    def test_no_se_puede_reembolsar_un_pago_ya_reembolsado(self, organization, customer):
        create_use_case = CreatePaymentUseCase(organization=organization)
        payment = create_use_case.execute(
            CreatePaymentRequest(
                customer_id=str(customer.id), amount=Decimal("10.00"), method=PaymentMethod.CASH
            )
        )
        refund_use_case = RefundPaymentUseCase()
        refund_use_case.execute(payment)

        with pytest.raises(domain_exceptions.ConflictError):
            refund_use_case.execute(payment)
