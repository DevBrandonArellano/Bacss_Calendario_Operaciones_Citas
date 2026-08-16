"""Test de concurrencia del motor de reservas (docs/booking-engine.md).

Dos solicitudes de reserva simultáneas al mismo slot no deben producir
doble reserva, ni siquiera cuando el bloqueo de aplicación no alcanza a
serializarlas (conjunto de filas vacío al momento del lock). La defensa
final es el `ExclusionConstraint` de PostgreSQL sobre `time_range`.

Usa `transaction=True` para que cada hilo abra su propia conexión real a
la base de datos y los cambios de un hilo sean visibles (o generen
conflicto real) para el otro, en vez de compartir la transacción
envolvente que usa pytest-django por defecto.
"""

import threading
from datetime import time

import pytest
from django.db import connections

from apps.appointments.models import ACTIVE_APPOINTMENT_STATUSES, Appointment
from apps.appointments.services import CreateAppointmentRequest, CreateAppointmentUseCase
from core import exceptions as domain_exceptions


@pytest.mark.django_db(transaction=True)
def test_concurrent_bookings_to_the_same_slot_do_not_double_book(
    organization, customer, service, employee, branch, monday
):
    successes: list[str] = []
    failures: list[Exception] = []
    barrier = threading.Barrier(2)

    def attempt_booking() -> None:
        try:
            barrier.wait(timeout=5)
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
            successes.append(str(appointment.id))
        except domain_exceptions.ConflictError as exc:
            failures.append(exc)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=attempt_booking) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)

    assert len(successes) == 1, f"Se esperaba exactamente 1 reserva exitosa, hubo {len(successes)}"
    assert len(failures) == 1, f"Se esperaba exactamente 1 conflicto, hubo {len(failures)}"

    active_appointments = Appointment.objects.all_objects.filter(
        organization=organization,
        employee=employee,
        appointment_date=monday,
        status__in=ACTIVE_APPOINTMENT_STATUSES,
    )
    assert active_appointments.count() == 1
