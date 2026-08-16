# API pública de integración (`/api/public/v1/...`)

## Alcance del v1 (recorte de esta fase, ver `docs/superpowers/plans/2026-08-16-fase-12b-public-api.md`)

- **Recursos de módulo activo** (`/api/public/v1/modules/{modulo}/...`) se difieren a una fase posterior: el patrón (autenticación/scopes/tenant por credencial) queda listo y documentado aquí, pero exponer moto/laboratorio/tienda/legal vía API pública es trabajo adicional por la sensibilidad y complejidad propia de cada módulo (especialmente laboratorio). No es parte de este incremento.
- **Notificación al administrador por fallo de webhook:** en v1 se limita a marcar `WebhookDelivery.status="failed"` tras agotar reintentos (visible vía `GET /api/public/v1/webhooks/{id}/deliveries/`), sin un canal de notificación push dedicado todavía.
- **Portal de developers:** se reutiliza el Swagger UI/Redoc ya publicado en `/api/docs/` (Fase 1), con los endpoints públicos agrupados bajo el tag `public-api`, en vez de construir un portal separado nuevo.

Producto en sí mismo, consumido por **sistemas de terceros**. Completamente separada de la API interna (`docs/api-interna.md`): distinto namespace, distinto esquema de autenticación, distinto throttling, y contrato con compromiso explícito de estabilidad y compatibilidad hacia atrás.

## Principios de diseño

- **Versionado explícito en la ruta:** `/api/public/v1/`. Un cambio incompatible nunca se aplica a `v1`; se publica `v2` y `v1` sigue funcionando durante el período de deprecación.
- **Multitenancy por credencial, no por payload:** cada credencial (`ApiKey` u `OAuthClient`) pertenece a exactamente una `Organization`. El tenant de cada request se resuelve desde la credencial autenticada; cualquier `organization_id` presente en el body se ignora o se rechaza si no coincide.
- **Mínimo privilegio vía scopes:** cada credencial declara los scopes que necesita; el permission class de DRF valida `scope requerido del endpoint ⊆ scopes de la credencial`.

## Autenticación

Dos mecanismos, ambos independientes del login de usuarios de la API interna:

1. **API Key** (server-to-server simple): header `Authorization: ApiKey {prefix}.{secret}`. El secreto se almacena hasheado (nunca en claro); el prefijo (primeros caracteres, visible en la UI de administración) permite identificar la key sin exponer el secreto. Soporta rotación (crear key nueva, revocar la vieja tras período de gracia).
2. **OAuth2 client-credentials** (integraciones más completas): `POST /api/public/v1/oauth/token/` con `client_id` + `client_secret` → `access_token` (JWT de corta duración, con `scope` y `org_id` embebidos) usado como `Authorization: Bearer {token}`.

## Scopes

Convención `recurso:acción`. Catálogo inicial:

`customers:read`, `customers:write`, `services:read`, `appointments:read`, `appointments:write`, `availability:read`, `payments:read`, `payments:write`, `webhooks:manage`, y equivalentes por módulo (`moto:read`, `laboratory:read` con restricciones adicionales por sensibilidad, `store:read`, `store:write`, `legal:read`).

Una tabla de decisión mapea cada endpoint público a su(s) scope(s) requerido(s); documentarla en el portal de developers (ver sección Documentación).

## Recursos expuestos (v1)

| Recurso | Rutas | Scope |
|---|---|---|
| Clientes | `GET/POST /api/public/v1/customers/`, `GET/PATCH /api/public/v1/customers/{id}/` | `customers:read` / `customers:write` |
| Servicios | `GET /api/public/v1/services/` | `services:read` |
| Disponibilidad | `GET /api/public/v1/availability/?service_id=&date=` | `availability:read` |
| Citas | `GET/POST /api/public/v1/appointments/`, `POST /api/public/v1/appointments/{id}/cancel/` | `appointments:read` / `appointments:write` |
| Pagos | `GET/POST /api/public/v1/payments/` | `payments:read` / `payments:write` |
| Webhooks | `GET/POST /api/public/v1/webhooks/`, `DELETE /api/public/v1/webhooks/{id}/` | `webhooks:manage` |
| Recursos de módulo activo | `/api/public/v1/modules/{modulo}/...` (mismo criterio que la API interna) | scope específico del módulo |

Todos reutilizan los mismos casos de uso/servicios que la API interna — no se duplica lógica de negocio, solo cambia la capa de serialización/autenticación/autorización.

## Paginación, filtros, orden

Igual convención que la API interna (`page`, `page_size`, `ordering`), pero con `page_size` máximo más bajo por defecto (protección adicional de cuota) y cabeceras `X-Total-Count` para clientes que no parsean el body de paginación.

## Idempotencia

Operaciones de escritura (`POST`, y `PATCH` que crean efectos secundarios) aceptan header `Idempotency-Key`. El servidor guarda `(api_key_id, idempotency_key) → response` durante 24 horas; una repetición con la misma clave devuelve la respuesta original sin re-ejecutar el efecto (crítico para reintentos de red en creación de citas/pagos).

## Rate limiting y cuotas

- Independiente del throttling de la API interna.
- Límite por credencial (configurable por plan futuro, ver `docs/roadmap.md`), p. ej. 60 req/min por defecto.
- Cabeceras en toda respuesta: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Al exceder: `429 Too Many Requests` + header `Retry-After` + cuerpo con el formato de error uniforme.

## Webhooks salientes

- Modelo `WebhookEndpoint` (URL destino, secreto, eventos suscritos, estado activo/inactivo) y `WebhookDelivery` (payload, respuesta, intentos, estado).
- Catálogo de eventos v1: `appointment.created`, `appointment.confirmed`, `appointment.cancelled`, `appointment.rescheduled`, `payment.registered`, `payment.refunded`, `order.status_changed`, `work_order.status_changed`, `lab_result.validated`, `case.status_changed`.
- Entrega firmada: header `X-Signature` = HMAC-SHA256 del body con el secreto del endpoint; el receptor puede verificar autenticidad e integridad.
- Reintentos con backoff exponencial vía Celery (p. ej. 1m, 5m, 30m, 2h, 12h; máximo N intentos, luego se marca `failed` y se notifica al administrador de la integración).
- Cada intento se registra en `WebhookDelivery` (código de respuesta, latencia, timestamp) para debugging del lado del tercero.

## Formato de error

Idéntico al estándar general (`docs/error-handling.md`): `{code, message, details, request_id}`. El `request_id` de la API pública se incluye también en los logs (`docs/logging.md`) junto al `client_id`/`key_id`, para que el equipo de soporte pueda correlacionar un reclamo de un tercero con los logs del servidor.

## Versionado y deprecación

- Un endpoint o campo no se elimina ni cambia de tipo/semántica dentro de `v1` sin coordinarlo como breaking change → nueva versión.
- Adiciones no rompientes (campo nuevo opcional, endpoint nuevo) sí se permiten dentro de `v1`.
- Política de deprecación: al publicar `v2`, `v1` se mantiene un mínimo de 6 meses, se anuncia en el portal de developers y se agrega header `Deprecation` + `Sunset` (RFC 8594) en las respuestas de `v1` durante ese período.

## Documentación y sandbox

- OpenAPI 3 autogenerado con `drf-spectacular`, publicado en Swagger UI/Redoc bajo un portal de developers.
- Incluye: guía de autenticación (API key y OAuth2), catálogo de scopes, límites de rate/cuota, guía de idempotencia, catálogo de eventos de webhook con ejemplos de payload, y ejemplos `curl` por recurso.
- Entorno **sandbox**: una organización demo con datos ficticios y credenciales de prueba, para que un tercero pueda integrar sin tocar datos reales.

## Observabilidad y seguridad

- Cada request público se loguea en formato RFC 5424 (`docs/logging.md`) con `client_id`/`key_id` y `correlation_id`.
- Acciones sensibles (rotación de key, cambio de scopes, alta/baja de webhook) quedan en `AuditLog`.
- Mismos controles ISO 27001 que el resto de la plataforma: TLS obligatorio, validación estricta de entrada, protección OWASP Top 10.

## Preparación para suscripciones

Los límites de rate, cuota, scopes disponibles y número de webhooks activos deben poder leerse desde el plan de suscripción de la organización (`Organization.settings` o tabla de plan futura), de modo que activar un plan superior simplemente cambie estos límites sin cambios de código.
