"""Regresión: los casos de uso deben funcionar sin contexto de tenant
pre-existente (hallazgo de la revisión previa a Fase 7).

`TenantAwareManager.get_queryset()` devuelve `.none()` cuando no hay
organización en `core.context`, y encadenar `.filter()` sobre una
queryset vacía sigue vacía — así que cualquier caso de uso que reciba
`organization`/`appointment` y lea vía el manager por defecto (`objects`)
debe fijar su propio contexto en `execute()` (`core.context.tenant_scope`),
en vez de depender de que alguien más (el middleware HTTP) ya lo haya
fijado. Este test llama a los casos de uso directamente, como lo haría un
test de servicio, un comando de management o una tarea de Celery — nunca
pasa por `CurrentOrganizationMiddleware`.
"""

from datetime import time

import pytest

from apps.appointments.models import AppointmentStatus
from apps.appointments.services import (
    CreateAppointmentRequest,
    CreateAppointmentUseCase,
    TransitionAppointmentUseCase,
)
from core.context import get_current_organization_id

pytestmark = pytest.mark.django_db


class TestCasosDeUsoFuncionanSinContextoPrevio:
    def test_crear_cita_sin_contexto_previo_funciona(
        self, organization, customer, service, employee, branch, monday
    ):
        assert get_current_organization_id() is None

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

        assert appointment.customer_id == customer.id

    def test_no_deja_contexto_filtrado_despues_de_ejecutar(
        self, organization, customer, service, employee, branch, monday
    ):
        """El contexto se restaura al valor anterior al salir de `execute()`,
        para no filtrar por accidente el tenant de la última operación en
        llamadas posteriores dentro del mismo hilo/tarea (p. ej. un worker
        de Celery que procesa citas de varias organizaciones seguidas)."""

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

        assert get_current_organization_id() is None

    def test_transicion_de_estado_sin_contexto_previo_funciona(
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
        assert get_current_organization_id() is None

        transition_use_case = TransitionAppointmentUseCase()
        updated = transition_use_case.transition(appointment, AppointmentStatus.CONFIRMED)

        assert updated.status == AppointmentStatus.CONFIRMED
        assert get_current_organization_id() is None
