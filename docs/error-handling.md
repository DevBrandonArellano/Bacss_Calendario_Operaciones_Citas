# Estándar de manejo de errores

## Taxonomía de excepciones de dominio

Definidas en `backend/core/exceptions.py`, independientes de DRF (la capa de servicios no debe conocer HTTP):

| Excepción | Significado | HTTP mapeado |
|---|---|---|
| `ValidationError` (dominio) | Datos de entrada inválidos según reglas de negocio (no solo de tipo/formato) | 400 |
| `PermissionDeniedError` | El usuario autenticado no tiene permiso para la acción | 403 |
| `NotFoundError` | La entidad no existe (o no pertenece al tenant del usuario, ver nota) | 404 |
| `ConflictError` | Conflicto de estado (doble reserva, transición de estado inválida, idempotencia violada) | 409 |
| `RateLimitExceededError` | Se excedió el límite de requests/cuota | 429 |
| `DomainError` (base) | Error de negocio genérico no cubierto por las anteriores | 422 |

**Nota de seguridad:** un recurso que existe pero pertenece a otra organización se trata como `NotFoundError` (404), nunca como `PermissionDeniedError` (403) — así no se filtra a un usuario que el recurso existe en otro tenant.

## Exception handler global (DRF)

Un `exception_handler` custom, registrado en `REST_FRAMEWORK.EXCEPTION_HANDLER`, intercepta toda excepción no capturada por la vista y:

1. Mapea excepciones de dominio a su código HTTP (tabla anterior).
2. Devuelve siempre el mismo formato de respuesta:

```json
{
  "code": "conflict.double_booking",
  "message": "El horario seleccionado ya no está disponible.",
  "details": { "employee_id": "...", "requested_start": "..." },
  "request_id": "uuid-correlation-id"
}
```

3. Registra el error con la severidad correcta (`docs/logging.md`): errores de negocio esperados (`ValidationError`, `ConflictError`, etc.) como `notice`/`warning`; excepciones no anticipadas (bugs) como `error`; fallas que comprometen disponibilidad del sistema como `critical`.
4. **Nunca** filtra stack traces, nombres de tabla/columna, ni datos sensibles al cliente — esos detalles solo van al log interno, no a `details` de la respuesta.

## Reglas generales

- Falla rápido y explícito: nunca `except: pass` ni captura silenciosa de excepciones esperables.
- Un error esperado (usuario mandó datos inválidos, intentó una transición de estado no permitida) se maneja con la taxonomía de arriba, no se oculta.
- Un error inesperado (bug, dependencia caída) se registra como `error`/`critical`, se devuelve como `500` genérico sin detalle interno, y dispara alerta (hook a Sentry, Fase 14).
- Todo `request_id` de la respuesta de error corresponde al `correlation_id` del log — permite al soporte pedirle al usuario/tercero el `request_id` y encontrar el log exacto.
