# Fase 15 — Portal de autoservicio de clientes (reserva online pública)

> **Estado:** plan inicial, sin empezar. No es parte de las 14 fases numeradas del roadmap original — es un gap detectado en la auditoría de documentación de 2026-08-19 (ver `docs/roadmap.md`, punto 12): el rol **Cliente** existe en RBAC desde la Fase 2 pero `Customer` no tiene mecanismo de login, así que hoy nadie externo puede reservar, cancelar o reprogramar por sí mismo. El spec original (secciones 4 y 10) lo pide explícitamente.
>
> **No confundir con la Fase 12B** (API pública de integración): esa fase es para *sistemas de terceros* (server-to-server, API Key/OAuth2 client-credentials). Esta fase es para el *cliente final humano* de la empresa, con su propio flujo de login ligero y una UI de reserva. Comparten el motor de disponibilidad/reservas pero son superficies completamente distintas — no deben mezclarse (mismo principio que separa `/api/...` de `/api/public/v1/...`).

## Objetivo

Que un cliente final (de cualquiera de los 4 rubros) pueda, sin ayuda de personal de la empresa:

1. Identificarse con algo que ya tiene (su email), sin crear ni recordar una contraseña nueva.
2. Ver los servicios activos de la empresa y la disponibilidad real (sin ver huecos ocupados ni datos de otros clientes).
3. Reservar, ver su propio historial de citas, cancelar y reprogramar.

Todo esto **sin duplicar** el motor de disponibilidad (`apps/scheduling/engine.py`) ni el motor de reservas (`apps/appointments/services.py`) — se exponen, no se reescriben.

## Decisión de diseño: autenticación del cliente

**Opción elegida: magic-link / OTP por email, no contraseña.**

- Reutiliza la abstracción de proveedor ya existente (`apps/notifications/providers.py::NotificationProvider`, con `EmailProvider` real vía SMTP desde la Fase 6) — no se agrega infraestructura de envío nueva.
- Evita duplicar todo el aparato de auth interno (`apps.authentication`: hashing, reset de contraseña, rate limiting específico, etc.) para una población de usuarios con expectativas distintas (compran/reservan poco, no quieren gestionar otra contraseña).
- Es coherente con `BookingChannel.ONLINE`, que **ya existe** en `apps/appointments/models.py` desde la Fase 5 (`online`, `staff`, `phone`, `api`) — la plataforma fue diseñada esperando este canal, solo falta construirlo.

**Alternativa descartada:** extender `Customer` con `password_hash` y flujo de login clásico (registro + contraseña + reset). Se descarta por ahora: más superficie de ataque (credenciales de baja fricción para atacantes, ya que `Customer.email` es público de cara al negocio) y más código de mantenimiento (reset de contraseña, políticas de complejidad) para un beneficio marginal frente al magic-link. Documentar como ADR si el equipo decide revertir esta elección — no cambiarla silenciosamente (regla de `CLAUDE.md`).

**Mecanismo concreto:**

1. `POST /api/client-portal/auth/request-code/` — recibe `{organization_slug, email}` (o `{organization_id, email}`; a decidir según cómo el frontend identifica la organización — subdominio, slug en la URL, o selector). Si existe un `Customer` con ese email en esa organización, genera un código OTP de un solo uso (6 dígitos, expira en 10 minutos, hasheado en BD igual que `ApiKey`/`OAuthClient` — `django.contrib.auth.hashers`) y lo envía por email vía `EmailProvider`. **Responde 202 siempre**, exista o no el cliente (no revelar si un email está registrado — mismo principio ya aplicado en `docs/auth-rbac.md`/`docs/security-strategy.md` para no filtrar existencia de cuentas).
2. `POST /api/client-portal/auth/verify-code/` — recibe `{organization_slug, email, code}`. Si el código es válido y no expiró, emite un JWT propio de corta duración (mismo patrón ya usado en `apps/integrations/authentication.py::issue_oauth_access_token` para el token `public_access` de client-credentials: firmado con `settings.SECRET_KEY`, `token_type` propio en el payload para no confundirse con los tokens internos de `simplejwt` ni con el `public_access` de integraciones). Este token identifica **un `Customer`**, no un `User` interno.
3. Middleware/autenticación DRF nueva (`ClientPortalJWTAuthentication`, mismo patrón que `PublicJWTAuthentication`) resuelve `request.user` a un principal ligero (`ClientPortalPrincipal`: `customer`, `organization`, sin roles/permisos de staff) y fija el tenant en `core.context` igual que ya hace `CurrentOrganizationMiddleware._resolve_public_api_organization_id` para la API pública — **el tenant se toma siempre de la credencial/token, nunca del payload** (regla #1, sin excepciones ni aquí).

## Seguridad (ISO 25010 / ISO 27001 — este es el endpoint más expuesto del sistema)

- **Rate limiting agresivo y específico** en `request-code`/`verify-code` (throttle scope propio, más estricto que `public_api`: éste es el endpoint más atractivo para fuerza bruta/enumeración de todo el backend). Sin límite, `verify-code` es un oráculo de 6 dígitos.
- **Nunca revelar si un email existe** en `request-code` (respuesta idéntica exista o no el `Customer`).
- **Aislamiento multitenant de punta a punta**: un `Customer` de la Empresa A nunca debe poder autenticarse ni consultar disponibilidad de la Empresa B, aunque adivine/reutilice un `organization_slug` ajeno. Replicar exactamente el patrón de test ya usado en `tests/test_tenant_isolation.py` y en los tests de Fase 12B (`test_appointments_isolated_between_organizations`) — mismo tipo de caso, nueva superficie.
- **Disponibilidad pública sin fugar datos**: el endpoint de slots disponibles nunca debe devolver quién ocupa un slot, solo si está libre — mismo contrato que `AvailabilityPublicView` de la Fase 12B (Tarea 8), reutilizable casi tal cual.
- El JWT de cliente debe ser de vida corta (recomendado: 24h, renovable con el mismo flujo de OTP) y llevar un `token_type` propio para que no pueda usarse por error como token de `simplejwt` ni como token `public_access` de integraciones en ningún endpoint interno.
- Todo intento de login (éxito/fallo) y toda reserva/cancelación hecha desde este canal quedan en `AuditLog` (igual que el resto del sistema) y en logging RFC 5424 con `customer_id`/`organization_id`/correlation-id — nunca con el código OTP en claro en logs.

## Alcance del incremento (si no alcanza el tiempo para todo)

Orden recomendado si hay que cortar el trabajo en una primera porción funcional y probada, de mayor a menor prioridad:

1. **Solo disponibilidad pública + catálogo de servicios** (sin login): reutilizar/exponer `AvailabilityPublicView` y `ServicePublicViewSet` de la Fase 12B bajo un namespace de cliente sin credencial (son datos no sensibles de por sí, ya pensados para exponerse). Entrega valor inmediato (un visitante ve horarios disponibles) sin tocar autenticación todavía.
2. **Login por OTP** (`request-code`/`verify-code` + `ClientPortalJWTAuthentication`), con sus tests de seguridad (rate limit, no-enumeración, aislamiento entre organizaciones) — la pieza de mayor riesgo, vale la pena aislarla y probarla a fondo antes de construir nada encima.
3. **Reservar** (`POST /api/client-portal/appointments/`, reutilizando `CreateAppointmentUseCase` con `booking_channel=BookingChannel.ONLINE`, `customer_id` tomado SIEMPRE del token, nunca del body).
4. **Ver historial propio, cancelar, reprogramar** (`GET/POST /api/client-portal/appointments/`, reutilizando `TransitionAppointmentUseCase`, alcance "solo mis citas" — mismo patrón de queryset acotado que ya existe para "profesional ve solo lo suyo" en Fase 11).
5. **Frontend** (nueva app o sección pública en `frontend/`, mobile-first, sin exponer horarios ocupados, flujo servicio → profesional → fecha → hora → datos → confirmación tal como pide la sección 10 del spec; modo claro/oscuro y accesibilidad WCAG 2.1 AA igual que el resto de `CLAUDE.md`).

No completar código a medias sin tests: si una sesión de trabajo no alcanza a cerrar un punto completo de esta lista, se detiene en el último punto totalmente cerrado (código + tests + verificación estática, mismo estándar que el resto del proyecto) y dejar el siguiente documentado como pendiente aquí.

## Archivos esperados

```
backend/apps/client_portal/          # nueva app, separada de apps/integrations (superficie distinta)
  models.py         # OtpCode (tenant-aware: organization, customer, code_hash, expires_at, consumed_at)
  authentication.py # ClientPortalJWTAuthentication, ClientPortalPrincipal, issue/verify helpers
  throttling.py      # throttle scope propio, más estricto que public_api
  views.py           # RequestCodeView, VerifyCodeView, luego AppointmentClientViewSet
  urls.py            # /api/client-portal/...
  tests/
docs/
  auth-rbac.md        # actualizar la fila "Cliente" con el mecanismo real (hoy dice "portal de reserva online / futura app")
  public-api.md        # aclarar explícitamente que este portal NO es la API pública de integración
  checklist.md          # agregar sección "Fase 15" con el detalle fase-por-fase, mismo formato que las demás
  roadmap.md            # mover este punto de "pendiente de decisión" a "en curso" una vez arranque código real
```

## Próximo paso

Antes de escribir código: decidir cómo el cliente/frontend identifica la organización (¿subdominio por empresa? ¿slug en la URL, `/portal/motors-ecuador/...`? ¿selector manual?) — el spec no lo especifica y afecta el contrato de `request-code`/`verify-code` y el enrutamiento del frontend. Es una decisión de producto, no técnica, mejor resuelta con el usuario antes de fijar el contrato de API.
