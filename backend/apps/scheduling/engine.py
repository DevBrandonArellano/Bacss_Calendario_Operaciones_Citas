"""Motor de disponibilidad (docs/availability-engine.md).

Componente puro: recibe parámetros, consulta datos y devuelve slots. No
escribe nada en la base de datos, por lo que es seguro exponerlo desde
cualquier canal (UI interna, reserva pública, API pública de integración)
sin riesgo de condiciones de carrera en esta capa.

Simplificación asumida: los horarios y bloqueos no cruzan medianoche (un
tramo siempre empieza y termina el mismo día). Se representa el tiempo
como minutos desde la medianoche para operar con aritmética de enteros.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time

from django.db.models import Q

from apps.appointments.models import ACTIVE_APPOINTMENT_STATUSES, Appointment
from apps.scheduling.models import AvailabilityBlock, Schedule
from apps.services.models import Employee
from core.context import tenant_scope

DEFAULT_SLOT_STEP_MINUTES = 15

Interval = tuple[int, int]  # (start_minutes, end_minutes), medianoche=0


def _time_to_minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def _minutes_to_time(value: int) -> time:
    return time(hour=value // 60, minute=value % 60)


def _subtract_interval(intervals: list[Interval], to_remove: Interval) -> list[Interval]:
    """Resta `to_remove` de cada intervalo de `intervals`, partiendo donde haga falta."""
    result: list[Interval] = []
    remove_start, remove_end = to_remove
    for start, end in intervals:
        if remove_end <= start or remove_start >= end:
            result.append((start, end))
            continue
        if remove_start > start:
            result.append((start, min(remove_start, end)))
        if remove_end < end:
            result.append((max(remove_end, start), end))
    return [iv for iv in result if iv[1] > iv[0]]


def _subtract_all(intervals: list[Interval], to_remove: list[Interval]) -> list[Interval]:
    for interval in to_remove:
        intervals = _subtract_interval(intervals, interval)
    return intervals


def _intersect(a: list[Interval], b: list[Interval]) -> list[Interval]:
    """Intersección de dos listas de intervalos disjuntos."""
    result: list[Interval] = []
    for a_start, a_end in a:
        for b_start, b_end in b:
            start, end = max(a_start, b_start), min(a_end, b_end)
            if end > start:
                result.append((start, end))
    return result


@dataclass(frozen=True)
class Slot:
    employee_id: str
    start_time: time
    end_time: time


def _working_intervals_for_day(
    *, organization_id: str, branch_id: str, employee_id: str | None, weekday: int
) -> list[Interval]:
    branch_schedules = Schedule.objects.filter(
        organization_id=organization_id, branch_id=branch_id, weekday=weekday, is_break=False
    )
    branch_hours = [(_time_to_minutes(s.start_time), _time_to_minutes(s.end_time)) for s in branch_schedules]
    branch_breaks = [
        (_time_to_minutes(s.start_time), _time_to_minutes(s.end_time))
        for s in Schedule.objects.filter(
            organization_id=organization_id, branch_id=branch_id, weekday=weekday, is_break=True
        )
    ]
    working = _subtract_all(branch_hours, branch_breaks)

    if employee_id is not None:
        employee_schedules = Schedule.objects.filter(
            organization_id=organization_id, employee_id=employee_id, weekday=weekday, is_break=False
        )
        employee_hours = [
            (_time_to_minutes(s.start_time), _time_to_minutes(s.end_time)) for s in employee_schedules
        ]
        employee_breaks = [
            (_time_to_minutes(s.start_time), _time_to_minutes(s.end_time))
            for s in Schedule.objects.filter(
                organization_id=organization_id, employee_id=employee_id, weekday=weekday, is_break=True
            )
        ]
        employee_working = _subtract_all(employee_hours, employee_breaks)
        working = _intersect(working, employee_working)

    return working


def _blocks_for_day(
    *, organization_id: str, branch_id: str, employee_id: str | None, target_date: date
) -> list[Interval]:
    blocks_qs = AvailabilityBlock.objects.filter(organization_id=organization_id, date=target_date)

    scope = Q(branch_id=branch_id) | Q(branch__isnull=True, employee__isnull=True)
    if employee_id is not None:
        scope |= Q(employee_id=employee_id)
    blocks_qs = blocks_qs.filter(scope)
    return [(_time_to_minutes(b.start_time), _time_to_minutes(b.end_time)) for b in blocks_qs]


def _booked_intervals_for_day(
    *, organization_id: str, employee_id: str, target_date: date, exclude_appointment_id: str | None = None
) -> list[Interval]:
    qs = Appointment.objects.filter(
        organization_id=organization_id,
        employee_id=employee_id,
        appointment_date=target_date,
        status__in=ACTIVE_APPOINTMENT_STATUSES,
    )
    if exclude_appointment_id is not None:
        qs = qs.exclude(id=exclude_appointment_id)
    return [(_time_to_minutes(a.start_time), _time_to_minutes(a.end_time)) for a in qs]


def _generate_slots(
    *, free_intervals: list[Interval], duration_minutes: int, step_minutes: int, employee_id: str
) -> list[Slot]:
    slots: list[Slot] = []
    for start, end in sorted(free_intervals):
        cursor = start
        while cursor + duration_minutes <= end:
            slots.append(
                Slot(
                    employee_id=employee_id,
                    start_time=_minutes_to_time(cursor),
                    end_time=_minutes_to_time(cursor + duration_minutes),
                )
            )
            cursor += step_minutes
    return slots


def _branch_matches_q(branch_id: str) -> Q:
    return Q(branch_id=branch_id) | Q(branch__isnull=True)


def get_available_slots(
    *,
    organization_id: str,
    branch_id: str,
    service_duration_minutes: int,
    target_date: date,
    employee_id: str | None = None,
    slot_step_minutes: int = DEFAULT_SLOT_STEP_MINUTES,
    exclude_appointment_id: str | None = None,
) -> list[Slot]:
    """Calcula los slots disponibles para uno o todos los empleados habilitados.

    Si `employee_id` es None, calcula para cada empleado activo de la
    sucursal (o de la organización si el empleado no tiene sucursal fija).
    """
    weekday = target_date.weekday()

    # `Schedule`/`AvailabilityBlock`/`Appointment`/`Employee` usan el manager
    # tenant-aware por defecto (`objects`), que solo resuelve filas con un
    # tenant fijado en el contexto (`core/context.py`). Esta función es
    # "pura" y se documenta como segura de llamar desde cualquier canal —
    # incluido fuera de una request HTTP, donde nada más fija ese contexto —
    # así que lo fija ella misma con el `organization_id` explícito que ya
    # recibe (el mismo patrón que `CreateAppointmentUseCase.execute`).
    with tenant_scope(organization_id):
        employee_ids: list[str]
        if employee_id is not None:
            employee_ids = [employee_id]
        else:
            employee_ids = list(
                Employee.objects.filter(organization_id=organization_id, is_active=True)
                .filter(_branch_matches_q(branch_id))
                .values_list("id", flat=True)
            )

        all_slots: list[Slot] = []
        for emp_id in employee_ids:
            working = _working_intervals_for_day(
                organization_id=organization_id, branch_id=branch_id, employee_id=emp_id, weekday=weekday
            )
            blocks = _blocks_for_day(
                organization_id=organization_id,
                branch_id=branch_id,
                employee_id=emp_id,
                target_date=target_date,
            )
            free = _subtract_all(working, blocks)
            booked = _booked_intervals_for_day(
                organization_id=organization_id,
                employee_id=emp_id,
                target_date=target_date,
                exclude_appointment_id=exclude_appointment_id,
            )
            free = _subtract_all(free, booked)
            all_slots.extend(
                _generate_slots(
                    free_intervals=free,
                    duration_minutes=service_duration_minutes,
                    step_minutes=slot_step_minutes,
                    employee_id=emp_id,
                )
            )
        return all_slots


def is_slot_free(
    *,
    organization_id: str,
    branch_id: str,
    employee_id: str,
    target_date: date,
    start_time: time,
    end_time: time,
    exclude_appointment_id: str | None = None,
) -> bool:
    """Verifica si un horario puntual cae dentro de un slot libre calculado por el motor."""
    requested_start = _time_to_minutes(start_time)
    requested_end = _time_to_minutes(end_time)
    weekday = target_date.weekday()

    # Ver comentario en `get_available_slots`: fija su propio tenant scope
    # para poder llamarse de forma segura fuera de una request HTTP.
    with tenant_scope(organization_id):
        working = _working_intervals_for_day(
            organization_id=organization_id, branch_id=branch_id, employee_id=employee_id, weekday=weekday
        )
        blocks = _blocks_for_day(
            organization_id=organization_id,
            branch_id=branch_id,
            employee_id=employee_id,
            target_date=target_date,
        )
        free = _subtract_all(working, blocks)
        booked = _booked_intervals_for_day(
            organization_id=organization_id,
            employee_id=employee_id,
            target_date=target_date,
            exclude_appointment_id=exclude_appointment_id,
        )
        free = _subtract_all(free, booked)

        return any(start <= requested_start and requested_end <= end for start, end in free)
