"""Motor de reservas (docs/booking-engine.md).

Único punto de escritura de citas: la UI del staff, la reserva online
pública y la API pública de integración deben pasar por estos casos de
uso, nunca crear/editar `Appointment` directamente.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from django.db import IntegrityError, transaction

from apps.appointments.models import ACTIVE_APPOINTMENT_STATUSES, Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.customers.models import Customer
from apps.scheduling.engine import is_slot_free
from apps.services.models import Employee, Service, ServiceStatus
from core import events
from core import exceptions as domain_exceptions
from core.context import tenant_scope


def _add_minutes(value: time, minutes: int) -> time:
    base = date(2000, 1, 1)
    return (datetime.combine(base, value) + timedelta(minutes=minutes)).time()


@dataclass(frozen=True)
class CreateAppointmentRequest:
    customer_id: str
    service_id: str
    employee_id: str
    branch_id: str
    appointment_date: date
    start_time: time
    notes: str = ""
    booking_channel: str = "staff"
    requires_confirmation: bool = False


class CreateAppointmentUseCase:
    """Aplica, en orden, las 8 validaciones del motor de reservas."""

    def __init__(self, *, organization):
        self.organization = organization

    def execute(self, request: CreateAppointmentRequest) -> Appointment:
        # Fija el tenant en el contexto para esta operación (docs/adr-001):
        # necesario porque `execute()` puede invocarse fuera de una request
        # HTTP (tests directos del caso de uso, `seed_demo`, hilos de
        # `test_concurrency.py`), donde `CurrentOrganizationMiddleware` no
        # corre y por tanto nadie más fija el contexto.
        with tenant_scope(self.organization.id):
            return self._execute(request)

    def _execute(self, request: CreateAppointmentRequest) -> Appointment:
        customer = self._get_valid_customer(request.customer_id)
        service = self._get_valid_service(request.service_id)
        employee = self._get_valid_employee(request.employee_id, service)
        branch = self._get_valid_branch(request.branch_id, service, employee)

        end_time = _add_minutes(request.start_time, service.duration_minutes)

        self._check_schedule_and_conflicts(
            branch=branch,
            employee=employee,
            appointment_date=request.appointment_date,
            start_time=request.start_time,
            end_time=end_time,
        )

        initial_status = (
            AppointmentStatus.PENDING if request.requires_confirmation else AppointmentStatus.CONFIRMED
        )

        appointment = self._persist(
            customer=customer,
            service=service,
            employee=employee,
            branch=branch,
            appointment_date=request.appointment_date,
            start_time=request.start_time,
            end_time=end_time,
            duration_minutes=service.duration_minutes,
            price=service.price,
            notes=request.notes,
            booking_channel=request.booking_channel,
            status=initial_status,
        )
        events.emit("appointment.created", appointment=appointment)
        if appointment.status == AppointmentStatus.CONFIRMED:
            events.emit("appointment.confirmed", appointment=appointment)
        return appointment

    # --- validaciones ---

    def _get_valid_customer(self, customer_id: str) -> Customer:
        customer = Customer.objects.filter(id=customer_id).first()
        if customer is None:
            raise domain_exceptions.NotFoundError("El cliente indicado no existe.")
        return customer

    def _get_valid_service(self, service_id: str) -> Service:
        service = Service.objects.filter(id=service_id).first()
        if service is None:
            raise domain_exceptions.NotFoundError("El servicio indicado no existe.")
        if service.status != ServiceStatus.ACTIVE:
            raise domain_exceptions.ValidationError("El servicio no está activo.")
        return service

    def _get_valid_employee(self, employee_id: str, service: Service) -> Employee:
        employee = Employee.objects.filter(id=employee_id).first()
        if employee is None:
            raise domain_exceptions.NotFoundError("El profesional indicado no existe.")
        if not employee.is_active:
            raise domain_exceptions.ValidationError("El profesional no está activo.")
        if not employee.services.filter(id=service.id).exists():
            raise domain_exceptions.ValidationError("El profesional no presta ese servicio.")
        return employee

    def _get_valid_branch(self, branch_id: str, service: Service, employee: Employee) -> Branch:
        branch = Branch.objects.filter(id=branch_id).first()
        if branch is None:
            raise domain_exceptions.NotFoundError("La sucursal indicada no existe.")
        if service.branches.exists() and not service.branches.filter(id=branch.id).exists():
            raise domain_exceptions.ValidationError("El servicio no está disponible en esa sucursal.")
        if employee.branch_id is not None and employee.branch_id != branch.id:
            raise domain_exceptions.ValidationError("El profesional no opera en esa sucursal.")
        return branch

    def _check_schedule_and_conflicts(
        self, *, branch: Branch, employee: Employee, appointment_date: date, start_time: time, end_time: time
    ) -> None:
        free = is_slot_free(
            organization_id=str(self.organization.id),
            branch_id=str(branch.id),
            employee_id=str(employee.id),
            target_date=appointment_date,
            start_time=start_time,
            end_time=end_time,
        )
        if not free:
            raise domain_exceptions.ConflictError(
                "El horario seleccionado ya no está disponible.",
                details={"employee_id": str(employee.id), "start_time": str(start_time)},
            )

    # --- persistencia con locking + defensa de base de datos ---

    def _persist(self, **fields) -> Appointment:
        employee: Employee = fields.pop("employee")
        appointment_date = fields["appointment_date"]

        with transaction.atomic():
            # Bloqueo pesimista: serializa reservas concurrentes para el
            # mismo empleado/fecha cuando ya existen citas activas ese día.
            list(
                Appointment.objects.select_for_update().filter(
                    organization=self.organization,
                    employee=employee,
                    appointment_date=appointment_date,
                    status__in=ACTIVE_APPOINTMENT_STATUSES,
                )
            )

            overlapping = Appointment.objects.filter(
                organization=self.organization,
                employee=employee,
                appointment_date=appointment_date,
                status__in=ACTIVE_APPOINTMENT_STATUSES,
                start_time__lt=fields["end_time"],
                end_time__gt=fields["start_time"],
            ).exists()
            if overlapping:
                raise domain_exceptions.ConflictError("El horario seleccionado ya no está disponible.")

            try:
                return Appointment.objects.create(organization=self.organization, employee=employee, **fields)
            except IntegrityError as exc:
                # Defensa final: el constraint de exclusión de PostgreSQL
                # atrapa la condición de carrera que el locking de arriba
                # no puede cubrir cuando el conjunto bloqueado estaba vacío.
                raise domain_exceptions.ConflictError(
                    "El horario seleccionado ya no está disponible."
                ) from exc


class TransitionAppointmentUseCase:
    """Aplica una transición de estado válida y registra el cambio en auditoría."""

    def __init__(self, *, actor_user=None):
        self.actor_user = actor_user

    def transition(self, appointment: Appointment, new_status: str, *, reason: str = "") -> Appointment:
        with tenant_scope(appointment.organization_id):
            return self._transition(appointment, new_status, reason=reason)

    def _transition(self, appointment: Appointment, new_status: str, *, reason: str = "") -> Appointment:
        if not appointment.can_transition_to(new_status):
            raise domain_exceptions.ConflictError(
                f"No se puede pasar de '{appointment.status}' a '{new_status}'.",
                details={"from": appointment.status, "to": new_status},
            )

        previous_status = appointment.status
        appointment.status = new_status
        if reason:
            appointment.notes = f"{appointment.notes}\n[{new_status}] {reason}".strip()
        appointment.save(update_fields=["status", "notes", "updated_at"])

        self._audit(appointment, previous_status, new_status)
        events.emit(f"appointment.{new_status}", appointment=appointment)
        return appointment

    def reschedule(self, appointment: Appointment, *, new_date: date, new_start_time: time) -> Appointment:
        with tenant_scope(appointment.organization_id):
            return self._reschedule(appointment, new_date=new_date, new_start_time=new_start_time)

    def _reschedule(self, appointment: Appointment, *, new_date: date, new_start_time: time) -> Appointment:
        if not appointment.can_transition_to(AppointmentStatus.RESCHEDULED):
            raise domain_exceptions.ConflictError(
                f"No se puede reprogramar una cita en estado '{appointment.status}'."
            )

        organization = appointment.organization
        use_case = CreateAppointmentUseCase(organization=organization)
        new_request = CreateAppointmentRequest(
            customer_id=str(appointment.customer_id),
            service_id=str(appointment.service_id),
            employee_id=str(appointment.employee_id),
            branch_id=str(appointment.branch_id),
            appointment_date=new_date,
            start_time=new_start_time,
            notes=appointment.notes,
            booking_channel=appointment.booking_channel,
            requires_confirmation=appointment.status != AppointmentStatus.CONFIRMED,
        )

        with transaction.atomic():
            new_appointment = use_case.execute(new_request)
            appointment.status = AppointmentStatus.RESCHEDULED
            appointment.save(update_fields=["status", "updated_at"])
            self._audit(appointment, appointment.status, AppointmentStatus.RESCHEDULED)

        events.emit("appointment.rescheduled", old_appointment=appointment, new_appointment=new_appointment)
        return new_appointment

    def _audit(self, appointment: Appointment, previous_status: str, new_status: str) -> None:
        from apps.audit.models import AuditAction
        from apps.audit.services import log_action

        log_action(
            action=AuditAction.UPDATE,
            entity_type="Appointment",
            entity_id=str(appointment.id),
            organization=appointment.organization,
            user=self.actor_user,
            changes={"status": {"from": previous_status, "to": new_status}},
        )
