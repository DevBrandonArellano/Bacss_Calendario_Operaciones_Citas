"""Tests del motor de disponibilidad (docs/availability-engine.md).

Técnicas de caja negra (particiones de equivalencia, valores límite,
tablas de decisión) sobre horario base × descanso × bloqueo × cita
existente, según docs/test-plan.md.
"""

from datetime import date, time, timedelta

import pytest

from apps.appointments.models import Appointment, AppointmentStatus
from apps.branches.models import Branch
from apps.scheduling.engine import get_available_slots, is_slot_free
from apps.scheduling.models import AvailabilityBlock, BlockReason, Schedule
from apps.services.models import Employee, Service

pytestmark = pytest.mark.django_db


def _next_monday() -> date:
    today = date.today()
    return today + timedelta(days=(7 - today.weekday()) % 7 or 7)


@pytest.fixture
def branch(organization):
    return Branch.all_objects.create(organization=organization, name="Sucursal Norte")


@pytest.fixture
def service(organization):
    return Service.all_objects.create(
        organization=organization, name="Corte", duration_minutes=30, price="10.00"
    )


@pytest.fixture
def employee(organization, branch, service):
    emp = Employee.all_objects.create(
        organization=organization, branch=branch, first_name="Ana", last_name="Prof"
    )
    emp.services.add(service)
    return emp


@pytest.fixture
def customer(organization):
    from apps.customers.models import Customer

    return Customer.all_objects.create(
        organization=organization, first_name="Cliente", last_name="Uno"
    )


@pytest.fixture
def monday(branch, employee, organization):
    target = _next_monday()
    weekday = target.weekday()
    Schedule.all_objects.create(
        organization=organization, branch=branch, weekday=weekday, start_time=time(9, 0), end_time=time(17, 0)
    )
    Schedule.all_objects.create(
        organization=organization,
        employee=employee,
        weekday=weekday,
        start_time=time(9, 0),
        end_time=time(17, 0),
    )
    return target


class TestSlotsBasicos:
    def test_sin_horario_configurado_no_hay_slots(self, organization, branch, service):
        slots = get_available_slots(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            service_duration_minutes=service.duration_minutes,
            target_date=_next_monday(),
        )

        assert slots == []

    def test_horario_completo_genera_slots(self, organization, branch, service, employee, monday):
        slots = get_available_slots(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            service_duration_minutes=service.duration_minutes,
            target_date=monday,
            employee_id=str(employee.id),
        )

        assert len(slots) > 0
        assert all(s.employee_id == str(employee.id) for s in slots)
        assert slots[0].start_time == time(9, 0)

    def test_ultimo_slot_no_excede_el_horario(self, organization, branch, service, employee, monday):
        slots = get_available_slots(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            service_duration_minutes=service.duration_minutes,
            target_date=monday,
            employee_id=str(employee.id),
        )

        assert slots[-1].end_time <= time(17, 0)


class TestDescansos:
    def test_descanso_excluye_slots_dentro_del_rango(self, organization, branch, employee, service, monday):
        Schedule.all_objects.create(
            organization=organization,
            branch=branch,
            weekday=monday.weekday(),
            start_time=time(12, 0),
            end_time=time(13, 0),
            is_break=True,
        )

        slots = get_available_slots(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            service_duration_minutes=service.duration_minutes,
            target_date=monday,
            employee_id=str(employee.id),
        )

        assert all(not (time(12, 0) <= s.start_time < time(13, 0)) for s in slots)

    def test_valor_limite_slot_termina_justo_cuando_empieza_el_descanso(
        self, organization, branch, employee, monday
    ):
        # Servicio de 30 min: el slot 11:30-12:00 debe ser válido (termina
        # justo cuando empieza el descanso, no hay solapamiento real).
        service_30 = Service.all_objects.create(
            organization=organization, name="Rápido", duration_minutes=30, price="5.00"
        )
        employee.services.add(service_30)
        Schedule.all_objects.create(
            organization=organization,
            branch=branch,
            weekday=monday.weekday(),
            start_time=time(12, 0),
            end_time=time(13, 0),
            is_break=True,
        )

        assert is_slot_free(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            employee_id=str(employee.id),
            target_date=monday,
            start_time=time(11, 30),
            end_time=time(12, 0),
        )
        assert not is_slot_free(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            employee_id=str(employee.id),
            target_date=monday,
            start_time=time(11, 45),
            end_time=time(12, 15),
        )


class TestBloqueos:
    def test_feriado_organizacional_bloquea_todos_los_slots(
        self, organization, branch, employee, service, monday
    ):
        AvailabilityBlock.all_objects.create(
            organization=organization,
            date=monday,
            start_time=time(0, 0),
            end_time=time(23, 59),
            reason=BlockReason.HOLIDAY,
        )

        slots = get_available_slots(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            service_duration_minutes=service.duration_minutes,
            target_date=monday,
            employee_id=str(employee.id),
        )

        assert slots == []

    def test_vacaciones_de_un_empleado_no_afectan_a_otro(
        self, organization, branch, employee, service, monday
    ):
        other_employee = Employee.all_objects.create(
            organization=organization, branch=branch, first_name="Otro", last_name="Prof"
        )
        other_employee.services.add(service)
        Schedule.all_objects.create(
            organization=organization,
            employee=other_employee,
            weekday=monday.weekday(),
            start_time=time(9, 0),
            end_time=time(17, 0),
        )
        AvailabilityBlock.all_objects.create(
            organization=organization,
            employee=employee,
            date=monday,
            start_time=time(9, 0),
            end_time=time(17, 0),
            reason=BlockReason.VACATION,
        )

        slots_blocked = get_available_slots(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            service_duration_minutes=service.duration_minutes,
            target_date=monday,
            employee_id=str(employee.id),
        )
        slots_other = get_available_slots(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            service_duration_minutes=service.duration_minutes,
            target_date=monday,
            employee_id=str(other_employee.id),
        )

        assert slots_blocked == []
        assert len(slots_other) > 0


class TestCitasExistentes:
    def test_cita_activa_excluye_su_horario(self, organization, branch, employee, service, customer, monday):
        Appointment.all_objects.create(
            organization=organization,
            branch=branch,
            customer=customer,
            service=service,
            employee=employee,
            appointment_date=monday,
            start_time=time(10, 0),
            end_time=time(10, 30),
            duration_minutes=30,
            price="10.00",
            status=AppointmentStatus.CONFIRMED,
        )

        assert not is_slot_free(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            employee_id=str(employee.id),
            target_date=monday,
            start_time=time(10, 0),
            end_time=time(10, 30),
        )

    def test_cita_cancelada_no_ocupa_agenda(self, organization, branch, employee, service, customer, monday):
        Appointment.all_objects.create(
            organization=organization,
            branch=branch,
            customer=customer,
            service=service,
            employee=employee,
            appointment_date=monday,
            start_time=time(10, 0),
            end_time=time(10, 30),
            duration_minutes=30,
            price="10.00",
            status=AppointmentStatus.CANCELLED,
        )

        assert is_slot_free(
            organization_id=str(organization.id),
            branch_id=str(branch.id),
            employee_id=str(employee.id),
            target_date=monday,
            start_time=time(10, 0),
            end_time=time(10, 30),
        )
