# Diseño del motor de disponibilidad

Vive en `backend/apps/scheduling/`, como componente **puro e independiente de la UI**: recibe parámetros, consulta datos, devuelve una lista de slots. No tiene efectos secundarios (no escribe nada), por lo que es seguro exponerlo tanto desde la API interna (`GET /api/availability/`) como desde la pública (`GET /api/public/v1/availability/`) sin duplicar lógica.

## Entradas

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `organization` | sí (implícito, del contexto de tenant) | Resuelto por middleware/credencial, nunca recibido como parámetro libre. |
| `service_id` | sí | Determina la `duration_minutes` a buscar. |
| `employee_id` | no | Si se omite, se calculan slots para **todos** los empleados que pueden prestar ese servicio y se agrupan por empleado. |
| `branch_id` | sí | Los horarios y bloqueos son por sucursal. |
| `date` o rango `date_from`/`date_to` | sí | Fecha(s) a consultar. |
| `duration_minutes` | no (por defecto, la del servicio) | Permite overrides puntuales (p. ej. cita combinada). |

## Fuentes de datos consultadas

1. `Schedule` — horario laboral base de la sucursal y del empleado (por día de semana), incluyendo bloques marcados `is_break` (almuerzo/descansos).
2. `AvailabilityBlock` — vacaciones, feriados, ausencias y bloqueos manuales (por fecha concreta, pueden ser de sucursal o de empleado).
3. `Appointment` — citas ya existentes en estados que ocupan el slot (`pending, confirmed, waiting, in_progress`; **no** `cancelled`, `no_show`, `completed` liberan el slot salvo `completed` que ya pasó).
4. `Service.duration_minutes` (o el override recibido).

## Algoritmo (resumen)

1. Para la fecha y empleado/sucursal dados, calcular el horario laboral bruto del día combinando `Schedule` de sucursal ∩ `Schedule` del empleado (el empleado no puede estar disponible fuera del horario de la sucursal).
2. Restar los bloques de descanso (`is_break=True`).
3. Restar los `AvailabilityBlock` que caen ese día (vacaciones, feriados, bloqueos manuales), a nivel de sucursal y de empleado.
4. Restar los intervalos ya ocupados por `Appointment` existentes del empleado ese día.
5. Sobre el tiempo resultante, generar slots discretos de tamaño `duration_minutes` (con un paso configurable, p. ej. cada 15 min, no necesariamente igual a la duración del servicio) que quepan completos dentro de un tramo libre.
6. Si no se especificó `employee_id`, repetir 1-5 para cada empleado habilitado para el servicio en esa sucursal y devolver el resultado agrupado.

## Salida

```json
{
  "service_id": "...",
  "branch_id": "...",
  "date": "2026-08-20",
  "slots": [
    {"employee_id": "...", "start_time": "09:00", "end_time": "09:30"},
    {"employee_id": "...", "start_time": "09:30", "end_time": "10:00"}
  ]
}
```

## Características no funcionales

- **Sin efectos secundarios:** solo lectura; no reserva nada (eso es responsabilidad exclusiva del motor de reservas, ver `docs/booking-engine.md`), evitando condiciones de carrera en esta capa.
- **Independiente de la UI y del canal:** el mismo componente se usa desde la vista de calendario del staff, desde la reserva online pública del cliente y desde la API pública de integración.
- **Rendimiento:** las consultas usan el índice compuesto `(organization_id, branch_id, employee_id, appointment_date)` de `Appointment` (ver `docs/erd.md`); se evita el patrón N+1 precargando horarios/bloqueos del rango de fechas consultado en una sola consulta por tabla.
- **Testeable en aislamiento:** al no depender de HTTP ni de la UI, se cubre con tests unitarios exhaustivos (valores límite de duración, solapamientos, bordes de horario) sin levantar el stack completo — ver `docs/test-plan.md`.
