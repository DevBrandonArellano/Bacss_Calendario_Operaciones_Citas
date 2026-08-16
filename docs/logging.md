# Estándar de logging — RFC 5424

## Niveles de severidad

Mapeo del logging de la aplicación a los 8 niveles RFC 5424:

| Nivel | Código | Uso en la plataforma |
|---|---|---|
| `emergency` | 0 | Sistema completamente inoperante (no se espera uso frecuente en esta plataforma) |
| `alert` | 1 | Requiere acción inmediata (p. ej. base de datos inaccesible) |
| `critical` | 2 | Falla crítica de un componente (p. ej. fallo del motor de reservas que impide crear citas) |
| `error` | 3 | Excepción no esperada, capturada por el exception handler global |
| `warning` | 4 | Situación anómala pero manejada (p. ej. reintento de webhook, rate limit alcanzado) |
| `notice` | 5 | Evento de negocio significativo pero normal (p. ej. cita cancelada, pago reembolsado) |
| `info` | 6 | Operación normal relevante (p. ej. cita creada, usuario autenticado) |
| `debug` | 7 | Detalle técnico solo para desarrollo, deshabilitado por defecto en producción |

## Formato

Todo log es JSON estructurado, un objeto por línea. Campos mínimos obligatorios:

```json
{
  "timestamp": "2026-08-14T15:32:10.123Z",
  "severity": "info",
  "service": "backend-api",
  "organization_id": "uuid-o-null",
  "user_id": "uuid-o-null",
  "request_id": "uuid-correlation-id",
  "event": "appointment.created",
  "data": { "appointment_id": "...", "employee_id": "..." }
}
```

- `timestamp`: ISO-8601 con milisegundos, UTC.
- `severity`: uno de los 8 niveles RFC 5424.
- `service`: nombre del proceso/servicio que emite el log (`backend-api`, `celery-worker`, `celery-beat`).
- `organization_id` / `user_id`: `null` cuando no aplique (p. ej. antes de autenticar, o eventos de plataforma).
- `request_id` (correlation-id): generado por middleware al inicio de cada request HTTP; propagado a las tareas Celery que esa request dispare, para poder rastrear un flujo completo (request → tarea asíncrona) con un solo identificador.
- `event`: nombre de evento en formato `dominio.accion` (reutiliza, cuando aplica, el mismo catálogo del bus de eventos de dominio de Fase 6).
- `data`: objeto con detalles estructurados relevantes al evento.

Para requests de la API pública se agregan además `client_id`/`key_id` de la credencial de integración.

## Qué NO se registra nunca

- Contraseñas en claro o hasheadas.
- Tokens de acceso/refresh completos (a lo sumo un prefijo/hash para correlación).
- PII innecesaria para el evento (documentos de identidad completos, direcciones) salvo que el propio evento lo requiera y esté justificado.
- Resultados clínicos (`LabResult`) ni contenido de casos legales en claro — se registra el `id` de la entidad y la acción, nunca el contenido sensible.
- Números de tarjeta u otra información de pago sensible.

## Canal de auditoría separado

`AuditLog` (ver `docs/erd.md`) es un canal distinto al logging operacional: es inmutable (sin `UPDATE`/`DELETE` desde la aplicación), vive en base de datos (no solo en archivos de log rotables), y registra específicamente acciones sensibles con quién, qué, cuándo y `correlation_id` para poder cruzarlo con los logs operacionales si hace falta investigar un incidente.
