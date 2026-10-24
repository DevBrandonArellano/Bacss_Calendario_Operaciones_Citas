"""Tests del motor de reservas (docs/booking-engine.md).

Cubre, en orden, las 8 validaciones y la máquina de estados. Técnicas de
caja negra (tabla de decisión de validaciones, transición de estados) y
caja blanca (cada validación tiene un caso que la hace fallar y uno que
la pasa).
"""

from datetime import time

import pytest

from apps.appointments.models import Appointment, AppointmentStatus
from apps.appointments.services import (
    CreateAppointmentRequest,
    CreateAppointmentUseCase,
    TransitionAppointmentUseCase,
)
from apps.branches.models import Branch
from apps.services.models import Employee, Service, ServiceStatus
from core import exceptions as domain_exceptions

pytestmark = pytest.mark.django_db


def _request(**overrides):
    defaults = dict(appointment_date=None, start_time=time(10, 0))
    defaults.update(overrides)
    return CreateAppointmentRequest(**defaults)


class TestValidacionesDelMotorDeReservas:
    def test_cliente_inexistente_lanza_not_found(self, organization, service, employee, branch, monday):
        use_case = CreateAppointmentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.NotFoundError):
            use_case.execute(
                CreateAppointmentRequest(
                    customer_id="00000000-0000-0000-0000-000000000000",
                    service_id=str(service.id),
                    employee_id=str(employee.id),
                    branch_id=str(branch.id),
                    appointment_date=monday,
                    start_time=time(10, 0),
                )
            )

    def test_servicio_inactivo_lanza_validation_error(self, organization, customer, employee, branch, monday):
        inactive_service = Service.all_objects.create(
            organization=organization,
            name="Inactivo",
            duration_minutes=30,
            price="5.00",
            status=ServiceStatus.INACTIVE,
        )
        employee.services.add(inactive_service)
        use_case = CreateAppointmentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                CreateAppointmentRequest(
                    customer_id=str(customer.id),
                    service_id=str(inactive_service.id),
                    employee_id=str(employee.id),
                    branch_id=str(branch.id),
                    appointment_date=monday,
                    start_time=time(10, 0),
                )
            )

    def test_empleado_que_no_presta_el_servicio_lanza_validation_error(
        self, organization, customer, branch, monday
    ):
        other_service = Service.all_objects.create(
            organization=organization, name="Otro", duration_minutes=30, price="5.00"
        )
        employee_sin_ese_servicio = Employee.all_objects.create(
            organization=organization, branch=branch, first_name="Sin", last_name="Servicio"
        )
        use_case = CreateAppointmentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                CreateAppointmentRequest(
                    customer_id=str(customer.id),
                    service_id=str(other_service.id),
                    employee_id=str(employee_sin_ese_servicio.id),
                    branch_id=str(branch.id),
                    appointment_date=monday,
                    start_time=time(10, 0),
                )
            )

    def test_empleado_inactivo_lanza_validation_error(
        self, organization, customer, service, employee, branch, monday
    ):
        employee.is_active = False
        employee.save(update_fields=["is_active"])
        use_case = CreateAppointmentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                CreateAppointmentRequest(
                    customer_id=str(customer.id),
                    service_id=str(service.id),
                    employee_id=str(employee.id),
                    branch_id=str(branch.id),
                    appointment_date=monday,
                    start_time=time(10, 0),
                )
            )

    def test_sucursal_que_no_ofrece_el_servicio_lanza_validation_error(
        self, organization, customer, employee, monday
    ):
        service_restringido = Service.all_objects.create(
            organization=organization, name="Restringido", duration_minutes=30, price="5.00"
        )
        otra_sucursal = Branch.all_objects.create(organization=organization, name="Otra")
        service_restringido.branches.add(otra_sucursal)
        employee.services.add(service_restringido)
        use_case = CreateAppointmentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.ValidationError):
            use_case.execute(
                CreateAppointmentRequest(
                    customer_id=str(customer.id),
                    service_id=str(service_restringido.id),
                    employee_id=str(employee.id),
                    branch_id=str(employee.branch_id),
                    appointment_date=monday,
                    start_time=time(10, 0),
                )
            )

    def test_horario_fuera_de_agenda_lanza_conflict_error(
        self, organization, customer, service, employee, branch, monday
    ):
        use_case = CreateAppointmentUseCase(organization=organization)

        with pytest.raises(domain_exceptions.ConflictError):
            use_case.execute(
                CreateAppointmentRequest(
                    customer_id=str(customer.id),
                    service_id=str(service.id),
                    employee_id=str(employee.id),
                    branch_id=str(branch.id),
                    appointment_date=monday,
                    start_time=time(20, 0),  # fuera de 09:00-17:00
                )
            )

    def test_slot_ocupado_lanza_conflict_error(
        self, organization, customer, service, employee, branch, monday
    ):
        use_case = CreateAppointmentUseCase(organization=organization)
        use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(customer.id),
                service_id=str(service.id),
                employee_id=str(employee.id),
                branch_id=str(branch.id),
                appointment_date=monday,
                start_time=time(10, 0),
            )
        )

        with pytest.raises(domain_exceptions.ConflictError):
            use_case.execute(
                CreateAppointmentRequest(
                    customer_id=str(customer.id),
                    service_id=str(service.id),
                    employee_id=str(employee.id),
                    branch_id=str(branch.id),
                    appointment_date=monday,
                    start_time=time(10, 15),  # se solapa con 10:00-10:30
                )
            )

    def test_creacion_exitosa_calcula_duracion_y_estado(
        self, organization, customer, service, employee, branch, monday
    ):
        use_case = CreateAppointmentUseCase(organization=organization)

        appointment = use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(customer.id),
                service_id=str(service.id),
                employee_id=str(employee.id),
                branch_id=str(branch.id),
                appointment_date=monday,
                start_time=time(10, 0),
            )
        )

        assert appointment.end_time == time(10, 30)
        assert appointment.duration_minutes == 30
        assert appointment.status == AppointmentStatus.CONFIRMED

    def test_requires_confirmation_crea_en_pendiente(
        self, organization, customer, service, employee, branch, monday
    ):
        use_case = CreateAppointmentUseCase(organization=organization)

        appointment = use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(customer.id),
                service_id=str(service.id),
                employee_id=str(employee.id),
                branch_id=str(branch.id),
                appointment_date=monday,
                start_time=time(10, 0),
                requires_confirmation=True,
            )
        )

        assert appointment.status == AppointmentStatus.PENDING


class TestTransicionesDeEstado:
    def _create_appointment(self, organization, customer, service, employee, branch, monday, **kwargs):
        use_case = CreateAppointmentUseCase(organization=organization)
        return use_case.execute(
            CreateAppointmentRequest(
                customer_id=str(customer.id),
                service_id=str(service.id),
                employee_id=str(employee.id),
                branch_id=str(branch.id),
                appointment_date=monday,
                start_time=time(10, 0),
                **kwargs,
            )
        )

    @pytest.mark.parametrize(
        "from_status,to_status,valid",
        [
            (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, True),
            (AppointmentStatus.PENDING, AppointmentStatus.COMPLETED, False),
            (AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS, True),
            (AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED, True),
            (AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, False),
            (AppointmentStatus.CANCELLED, AppointmentStatus.CONFIRMED, False),
        ],
    )
    def test_transiciones(
        self, organization, customer, service, employee, branch, monday, from_status, to_status, valid
    ):
        appointment = self._create_appointment(organization, customer, service, employee, branch, monday)
        appointment.status = from_status
        appointment.save(update_fields=["status"])

        use_case = TransitionAppointmentUseCase()
        if valid:
            use_case.transition(appointment, to_status)
            assert appointment.status == to_status
        else:
            with pytest.raises(domain_exceptions.ConflictError):
                use_case.transition(appointment, to_status)

    def test_reschedule_creates_new_appointment_and_marks_old_as_rescheduled(
        self, organization, customer, service, employee, branch, monday
    ):
        appointment = self._create_appointment(organization, customer, service, employee, branch, monday)

        use_case = TransitionAppointmentUseCase()
        new_appointment = use_case.reschedule(appointment, new_date=monday, new_start_time=time(11, 0))

        appointment.refresh_from_db()
        assert appointment.status == AppointmentStatus.RESCHEDULED
        assert new_appointment.start_time == time(11, 0)
        assert new_appointment.status == AppointmentStatus.CONFIRMED
        assert Appointment.all_objects.filter(organization=organization).count() == 2
