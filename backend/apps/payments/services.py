"""Casos de uso de pagos (docs/roadmap.md, Fase 7).

Único punto de escritura de `Payment`: registra el pago, recalcula el
`payment_status` agregado de la cita asociada (docs/erd.md) y deja
auditoría — igual que el motor de reservas es el único punto de escritura
de `Appointment` (docs/booking-engine.md). Toda regla financiera vive
aquí, nunca en vistas/serializers (ver CLAUDE.md).
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.appointments.models import Appointment
from apps.appointments.models import PaymentStatus as AppointmentPaymentStatus
from apps.customers.models import Customer
from apps.payments.models import Payment, PaymentStatus
from core import events
from core import exceptions as domain_exceptions
from core.context import tenant_scope


def _recompute_appointment_payment_status(appointment: Appointment) -> None:
    """Agrega los `Payment` de la cita en el `payment_status` de `Appointment`.

    Un pago parcial es una propiedad *agregada*: la suma de transacciones
    `paid` frente al precio de la cita, no el estado de una transacción
    individual (ver `apps/payments/models.py::PaymentStatus`).
    """

    payments = appointment.payments.all()
    total_paid = sum((p.amount for p in payments if p.status == PaymentStatus.PAID), Decimal("0"))
    total_refunded = sum((p.amount for p in payments if p.status == PaymentStatus.REFUNDED), Decimal("0"))

    if appointment.price > 0 and total_paid >= appointment.price:
        new_status = AppointmentPaymentStatus.PAID
    elif total_paid > 0:
        new_status = AppointmentPaymentStatus.PARTIAL
    elif total_refunded > 0:
        new_status = AppointmentPaymentStatus.REFUNDED
    else:
        new_status = AppointmentPaymentStatus.UNPAID

    if appointment.payment_status != new_status:
        appointment.payment_status = new_status
        appointment.save(update_fields=["payment_status", "updated_at"])


@dataclass(frozen=True)
class CreatePaymentRequest:
    customer_id: str
    amount: Decimal
    method: str
    appointment_id: str | None = None
    notes: str = ""


class CreatePaymentUseCase:
    def __init__(self, *, organization, actor_user=None):
        self.organization = organization
        self.actor_user = actor_user

    def execute(self, request: CreatePaymentRequest) -> Payment:
        # Ver core.context.tenant_scope: necesario para que las lecturas de
        # abajo (Customer/Appointment vía manager tenant-aware) funcionen
        # también fuera de una request HTTP.
        with tenant_scope(self.organization.id):
            return self._execute(request)

    def _execute(self, request: CreatePaymentRequest) -> Payment:
        customer = self._get_valid_customer(request.customer_id)
        appointment = self._get_valid_appointment(request.appointment_id, customer)
        self._validate_amount(request.amount)

        with transaction.atomic():
            payment = Payment.objects.create(
                organization=self.organization,
                customer=customer,
                appointment=appointment,
                amount=request.amount,
                method=request.method,
                status=PaymentStatus.PAID,
                paid_at=timezone.now(),
                notes=request.notes,
            )
            if appointment is not None:
                _recompute_appointment_payment_status(appointment)

        self._audit_create(payment)
        events.emit("payment.registered", payment=payment)
        return payment

    def _get_valid_customer(self, customer_id: str) -> Customer:
        customer = Customer.objects.filter(id=customer_id).first()
        if customer is None:
            raise domain_exceptions.NotFoundError("El cliente indicado no existe.")
        return customer

    def _get_valid_appointment(self, appointment_id: str | None, customer: Customer) -> Appointment | None:
        if appointment_id is None:
            return None
        appointment = Appointment.objects.filter(id=appointment_id).first()
        if appointment is None:
            raise domain_exceptions.NotFoundError("La cita indicada no existe.")
        if appointment.customer_id != customer.id:
            raise domain_exceptions.ValidationError("La cita no pertenece al cliente indicado.")
        return appointment

    def _validate_amount(self, amount: Decimal) -> None:
        if amount <= 0:
            raise domain_exceptions.ValidationError("El monto del pago debe ser mayor a cero.")

    def _audit_create(self, payment: Payment) -> None:
        from apps.audit.models import AuditAction
        from apps.audit.services import log_action

        log_action(
            action=AuditAction.CREATE,
            entity_type="Payment",
            entity_id=str(payment.id),
            organization=payment.organization,
            user=self.actor_user,
            changes={"amount": str(payment.amount), "method": payment.method, "status": payment.status},
        )


class RefundPaymentUseCase:
    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def execute(self, payment: Payment, *, reason: str = "") -> Payment:
        with tenant_scope(payment.organization_id):
            return self._execute(payment, reason=reason)

    def _execute(self, payment: Payment, *, reason: str = "") -> Payment:
        if payment.status != PaymentStatus.PAID:
            raise domain_exceptions.ConflictError(
                f"No se puede reembolsar un pago en estado '{payment.status}'.",
                details={"status": payment.status},
            )

        with transaction.atomic():
            payment.status = PaymentStatus.REFUNDED
            payment.refunded_at = timezone.now()
            if reason:
                payment.notes = f"{payment.notes}\n[refund] {reason}".strip()
            payment.save(update_fields=["status", "refunded_at", "notes", "updated_at"])

            if payment.appointment_id is not None:
                _recompute_appointment_payment_status(payment.appointment)

        self._audit_refund(payment)
        events.emit("payment.refunded", payment=payment)
        return payment

    def _audit_refund(self, payment: Payment) -> None:
        from apps.audit.models import AuditAction
        from apps.audit.services import log_action

        log_action(
            action=AuditAction.UPDATE,
            entity_type="Payment",
            entity_id=str(payment.id),
            organization=payment.organization,
            user=self.actor_user,
            changes={"status": {"to": PaymentStatus.REFUNDED}},
        )
