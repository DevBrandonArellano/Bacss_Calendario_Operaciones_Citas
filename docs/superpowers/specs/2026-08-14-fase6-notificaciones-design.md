# Fase 6 — Notificaciones y recordatorios (diseño)

Fecha: 2026-08-14
Estado: aprobado por el usuario, pendiente de implementación

## Contexto

La Fase 6 estaba planificada en `docs/roadmap.md` y `docs/checklist.md` pero
no tenía código: solo el scaffold vacío de `apps/notifications/` (paquetes
`management/commands`, `migrations`, `tests` sin contenido). Ya existen dos
piezas construidas en fases previas de las que esta fase depende:

- `core/events.py`: bus de eventos de dominio síncrono, in-process
  (`events.emit(nombre, **payload)` / `@events.on(nombre)`). Un handler que
  lanza excepción se loguea como `error` y no rompe el flujo que emitió el
  evento.
- `apps/appointments/services.py` ya emite: `appointment.created`,
  `appointment.confirmed`, `appointment.{new_status}` (para cualquier
  transición de estado), `appointment.rescheduled`.
- `EMAIL_BACKEND`, `DEFAULT_FROM_EMAIL`, `CELERY_BROKER_URL`,
  `CELERY_RESULT_BACKEND` ya configurados en `config/settings/base.py`
  (falta `CELERY_BEAT_SCHEDULE`).
- `Organization.timezone` / `default_currency` ya existen como config por
  organización (`apps/organizations/models.py`).

## Decisiones (confirmadas con el usuario)

1. **Plantillas en PostgreSQL** (`NotificationTemplate`), no en archivos de
   código: editables por organización sin desplegar, con fallback a una
   plantilla global si la organización no tiene override.
2. **Centro de notificaciones internas: solo staff/usuarios internos.** El
   cliente final no tiene login/portal propio en este MVP, así que
   `Notification.recipient_user` es el único destinatario del centro
   interno; `Notification.customer` existe para las notificaciones
   externas (email al cliente) pero no para un centro de notificaciones que
   el cliente consulte.
3. **Recordatorios configurables por organización**
   (`NotificationSetting.reminder_offsets_hours`, p. ej. `[24, 2]`), no un
   único offset fijo global.
4. **Stubs de WhatsApp/SMS**: loguean el intento (RFC 5424, sin PII
   innecesaria) y marcan la notificación como `sent` (éxito simulado),
   dejando la interfaz de proveedor lista para conectar un proveedor real
   en la 2ª etapa sin tocar el resto del sistema.
5. **Eventos de cita → email al cliente en esta fase**: solo
   `appointment.confirmed` y `appointment.cancelled`. Otros eventos
   (`created`, `rescheduled`, etc.) no generan email al cliente todavía,
   aunque sí pueden generar notificación interna al staff.

## Modelos (`apps/notifications/models.py`)

### `NotificationTemplate`
- `organization` (FK a `Organization`, **nullable** = plantilla global).
- `event_code` (str, p. ej. `appointment.confirmed`).
- `channel` (`email|sms|whatsapp|internal`).
- `subject_template` (str, vacío para canales sin asunto).
- `body_template` (text, sintaxis de Django templates, renderizado con el
  contexto que arma el handler/tarea que dispara la notificación).
- `is_active` (bool).
- Restricción de unicidad: `(organization, event_code, channel)` — con
  `organization=None` representando la plantilla global para ese
  `(event_code, channel)`.

Resolución de plantilla: se busca primero
`(organization=org, event_code, channel, is_active=True)`; si no existe, se
usa `(organization=None, event_code, channel, is_active=True)`. Si tampoco
existe, no se genera `Notification` para ese canal (se loguea `notice`, no
es un error).

### `NotificationSetting`
- `organization` (FK, **OneToOne**).
- `reminder_offsets_hours` (JSONB, lista de enteros positivos, p. ej.
  `[24, 2]`). Lista vacía = recordatorios desactivados para esa
  organización.
- `enabled_channels` (JSONB, lista de valores de canal habilitados para
  recordatorios; por defecto `["email"]`).

### `Notification`
- `organization` (FK).
- `recipient_user` (FK a `User`, nullable — destinatario del centro interno
  o de un canal externo dirigido a staff).
- `customer` (FK a `Customer`, nullable — destinatario externo cliente).
- `appointment` (FK a `Appointment`, nullable — trazabilidad, no toda
  notificación está ligada a una cita).
- `channel` (`email|sms|whatsapp|internal`).
- `event_code` (str).
- `template` (FK a `NotificationTemplate`, nullable — puede perderse si se
  borra la plantilla, la notificación ya enviada se conserva).
- `status` (`queued|sent|failed|read`).
- `payload` (JSONB — contexto renderizado + metadatos, p. ej.
  `{"reminder_offset_hours": 24}` para deduplicar recordatorios).
- `error_message` (text, nullable).
- `sent_at`, `read_at` (datetime, nullable).
- Índices: `(organization, recipient_user, status)`,
  `(organization, customer)`.
- Regla de negocio (no en vistas): solo se puede marcar `read` si
  `status == "sent"` y el `recipient_user` es el usuario autenticado de la
  misma organización.

## Abstracción de proveedor (`apps/notifications/providers/`)

```
class NotificationProvider(Protocol):
    def send(self, notification: Notification) -> ProviderResult: ...

class ProviderResult:
    success: bool
    error_message: str | None
```

- `EmailProvider`: usa `django.core.mail.send_mail` /
  `EmailMultiAlternatives` con `DEFAULT_FROM_EMAIL`. Requiere email del
  destinatario (`customer.email` o `recipient_user.email`); si no hay
  email, `ProviderResult(success=False, error_message="sin email")`.
- `WhatsAppStubProvider` / `SMSStubProvider`: loguean (`info`, RFC 5424,
  sin cuerpo del mensaje si contiene datos sensibles — solo
  `event_code`/`notification_id`/canal) y devuelven
  `ProviderResult(success=True)`.
- `InternalProvider`: no envía nada externo, el `send` es un no-op exitoso
  (la persistencia de `Notification` ya es la "entrega" al centro interno).
- `get_provider(channel: str) -> NotificationProvider`: factory simple
  (dict de registro), para que el caso de uso dependa de la interfaz, no de
  la implementación (DIP), y sea trivial sustituir un stub por un
  proveedor real después.

## Caso de uso (`apps/notifications/services.py`)

```
class NotifyEventUseCase:
    def notify(
        self,
        *,
        event_code: str,
        organization: Organization,
        context: dict,
        recipient_user: User | None = None,
        customer: Customer | None = None,
        appointment: Appointment | None = None,
        channels: list[str] | None = None,  # None = todos los canales con plantilla activa
    ) -> list[Notification]: ...
```

- Resuelve qué canales aplican (intersección de `channels` pedido, si se
  da, con los canales que tienen plantilla activa resuelta para
  `event_code`/`organization`).
- Por cada canal: renderiza plantilla con `context` (Django Template
  engine, `Context` sandboxeado a los datos pasados — nunca ejecuta código
  arbitrario), crea `Notification(status="queued")`, llama a
  `get_provider(channel).send(notification)`, actualiza `status` a
  `sent`/`failed` + `sent_at`/`error_message` según `ProviderResult`.
- Nunca relanza excepciones del proveedor: las captura, marca `failed`,
  loguea `error` con `correlation_id` — igual que ya exige `core/events.py`
  para los handlers de eventos.

## Conexión con el bus de eventos (`apps/notifications/handlers.py`)

- `@events.on("appointment.confirmed")` y `@events.on("appointment.cancelled")`:
  arman `context` desde la cita (cliente, servicio, profesional, fecha/hora
  en la zona horaria de la organización) y llaman a
  `NotifyEventUseCase().notify(event_code=..., organization=appointment.organization, context=..., customer=appointment.customer, appointment=appointment, channels=["email"])`.
- `@events.on("appointment.created")`, `@events.on("appointment.rescheduled")`,
  y el resto de transiciones de estado (`appointment.{status}` genérico):
  generan solo notificación **interna** (`channels=["internal"]`) al
  `recipient_user` = profesional asignado a la cita, para alimentar el
  centro de notificaciones del staff. (No hay email al cliente para estos
  eventos en esta fase, según la decisión 5.)
- Los handlers se registran importando este módulo desde
  `NotificationsConfig.ready()` en `apps/notifications/apps.py` (mismo
  patrón que usarían otras apps que necesiten registrar side effects al
  arrancar Django).

## Recordatorios programados (`apps/notifications/tasks.py` + Celery beat)

- Tarea periódica `send_appointment_reminders` (Celery beat, cada 15 min).
- Por cada `Organization` con `NotificationSetting.reminder_offsets_hours`
  no vacío:
  - Por cada `offset` en esa lista: calcula la ventana
    `[now + offset_h, now + offset_h + 15min)` en la zona horaria de la
    organización.
  - Busca `Appointment` con `status="confirmed"` cuyo
    `(appointment_date, start_time)` caiga en esa ventana.
  - Si ya existe una `Notification` para esa cita con
    `event_code="appointment.reminder"` y
    `payload__reminder_offset_hours=offset` (dedupe), se omite.
  - Si no, llama a
    `NotifyEventUseCase().notify(event_code="appointment.reminder", ..., channels=NotificationSetting.enabled_channels)`
    con `payload` inicial incluyendo `reminder_offset_hours=offset`.
- `CELERY_BEAT_SCHEDULE` en `config/settings/base.py` registra la tarea.
- Valor límite explícito a testear: una cita que empieza exactamente en el
  borde de la ventana (`now + offset_h` exacto) debe incluirse; una que cae
  un segundo después de la ventana no.

## API interna (`apps/notifications/views.py`, `urls.py`)

- `GET /api/notifications/`: lista paginada (usa `core/pagination.py`) de
  `Notification.objects.filter(organization=request.organization, recipient_user=request.user)`,
  filtrable por `?status=`. Ordenado por `-created_at`.
- `POST /api/notifications/{id}/read/`: usa un caso de uso
  (`MarkNotificationReadUseCase`), no lógica en la vista; 404 si la
  notificación no pertenece al usuario/organización autenticados (nunca
  403 que confirme existencia cross-tenant).
- Sigue el formato de error uniforme y el exception handler global ya
  existentes (`core/exception_handler.py`, `core/exceptions.py`).

## Frontend

- Ícono de campana en el layout autenticado con contador de no leídas
  (`status="sent"` cuenta como no leída; `status="read"` no cuenta).
- Dropdown/lista simple: título (deriva de `event_code` + datos de
  `payload`), fecha, click → `POST .../read/` y refresco del contador.
- Reutiliza el cliente API existente (mismo patrón que
  `CustomerListPage`/`CalendarPage`).

## Seed/demo

- Plantillas globales (`organization=None`) para
  `appointment.confirmed` / `appointment.cancelled` (email) y para
  `appointment.reminder` (email) — necesarias para que el sistema
  funcione out-of-the-box antes de que una organización personalice nada.
- `NotificationSetting(reminder_offsets_hours=[24, 2], enabled_channels=["email"])`
  para "Motors Ecuador" y "Laboratorio ABC" en el seed demo existente.

## Testing (TDD, ISTQB — caja negra y caja blanca)

- **Modelos**: unicidad de `NotificationTemplate` por
  `(organization, event_code, channel)`; `NotificationSetting` uno por
  organización.
- **Resolución de plantilla**: override de organización gana sobre global;
  fallback a global si no hay override; ningún canal se dispara si no hay
  plantilla activa en absoluto (ni override ni global).
- **`NotifyEventUseCase`**: crea `Notification` por canal aplicable; un
  fallo del proveedor marca `failed` y no propaga excepción; respeta
  `channels` pedido explícitamente.
- **Proveedores**: `EmailProvider` sin email del destinatario →
  `success=False`; stubs de WhatsApp/SMS siempre `success=True` y loguean
  sin datos sensibles en el mensaje logueado.
- **Handlers de eventos**: `appointment.confirmed`/`cancelled` generan
  notificación de email al cliente con los datos correctos de la cita;
  otras transiciones generan solo notificación interna al profesional.
- **Tarea de recordatorios**: genera notificación por cada offset
  configurado; no duplica si ya se envió para ese offset; respeta el
  borde de la ventana de tiempo (valor límite exacto vs. un segundo
  después); aislamiento por tenant (una organización nunca genera
  recordatorios de citas de otra).
- **API**: un usuario solo ve y marca-como-leídas sus propias
  notificaciones dentro de su organización; 404 (no 403) ante intento de
  acceso cross-tenant o de otro usuario.
- Cobertura objetivo: ≥ 80% general, alineado con `docs/test-plan.md`
  (los motores de disponibilidad/reservas ya cubiertos en Fase 5 mantienen
  su ≥ 90%; esta fase no es un componente "crítico" en ese sentido pero se
  cubre TDD completo igual).

## Fuera de alcance de esta fase

- Integración real de WhatsApp/SMS con proveedores externos (2ª etapa, ver
  `docs/roadmap.md`).
- Notificaciones al cliente para eventos distintos de
  confirmada/cancelada/recordatorio.
- Centro de notificaciones visible para el cliente final (no tiene portal
  propio todavía).
- Preferencias de notificación configurables por usuario/cliente
  individual (silenciar canal, etc.) — solo hay config por organización.
