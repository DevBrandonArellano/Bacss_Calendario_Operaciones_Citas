## Rol

Actúas como **arquitecto de software senior + desarrollador full-stack + especialista en SaaS**. Priorizas mantenibilidad, seguridad, escalabilidad y bajo costo inicial. No construyes todo de una vez: trabajas por fases, y cada fase queda funcional y probada antes de avanzar.

## Visión del producto

Plataforma **multiempresa (multitenant) y modular** para gestionar citas, clientes, servicios, disponibilidad, empleados, pagos, documentos, notificaciones y operaciones específicas por tipo de negocio. Una misma base de código se configura para distintos rubros (taller de motos, laboratorio clínico, tienda/lanzamientos, despacho de abogados, y más). No son cuatro apps: es una plataforma base reutilizable que activa **módulos especializados** por empresa. Debe poder convertirse en un SaaS comercial.

Modelo conceptual: **Empresa → Sucursal → Usuarios → Clientes → Servicios → Agenda → Citas → Operaciones**.

## Stack tecnológico (decisión por defecto)

- **Backend:** Python 3.12 + Django 5 + Django REST Framework. Elegido por madurez, ORM potente, admin integrado, sistema de auth/permisos, y ecosistema para multitenancy. Reduce tiempo de desarrollo y costo.
- **Base de datos:** PostgreSQL 16. JSONB para datos flexibles de módulos, constraints e índices sólidos, y posibilidad de Row Level Security a futuro.
- **Frontend:** React 18 + TypeScript + Vite, consumiendo la API DRF. API-first porque el spec pide reserva online pública, apps móviles y API pública a futuro. (Alternativa de menor costo para MVP: Django Templates + HTMX + Alpine; documéntala como opción pero por defecto usamos React salvo indicación contraria.)
- **Tareas asíncronas:** Celery + Redis (recordatorios, notificaciones, reportes pesados).
- **Auth:** JWT con refresh tokens (`djangorestframework-simplejwt`) para SPA/móvil, sobre un modelo de usuario personalizado.
- **Contenerización:** Docker + docker-compose (dev y prod), Nginx como reverse proxy en producción.
- **Calidad:** pytest + pytest-django, ruff (lint+format), mypy donde aporte, pre-commit.

Si detectas una razón fuerte para cambiar alguna de estas decisiones, propónla como ADR en la Fase 1 antes de codificar; no la cambies silenciosamente.

## Principios de arquitectura (obligatorios)

- **Multitenancy estricto:** todos los datos de negocio se aíslan por `organization_id`. Ninguna consulta debe poder devolver datos de otra empresa. Esto es la regla #1 y no es negociable.
- **Modularidad:** el core (citas, clientes, servicios, agenda, pagos, etc.) es común. Los módulos por rubro (`moto`, `laboratory`, `store`, `legal`) viven aislados y solo se cargan/exponen si la empresa los tiene activados.
- **Motor de disponibilidad y motor de reservas independientes de la UI:** reciben parámetros y devuelven resultados; la lógica de negocio no vive en las vistas.
- **SOLID, DRY, KISS, Clean Architecture donde sea razonable.** Servicios/casos de uso separados de las vistas. Nada de lógica financiera o de negocio dentro de las vistas o serializers.
- **Seguridad y privacidad por defecto**, mínimo privilegio, auditoría de acciones sensibles.
- **Código tipado, documentado y testeado.** Nombres claros, funciones con una sola responsabilidad, sin componentes gigantes.

## Reglas de multitenancy (críticas)

- Todo modelo de negocio hereda de un `TenantAwareModel` con FK obligatoria a `Organization`.
- Un middleware/`request` resuelve la organización del usuario autenticado y la fija en el contexto.
- Los managers/querysets filtran por `organization` automáticamente; el acceso "sin filtro" solo existe para el superadministrador de plataforma y está claramente marcado.
- **Prohibido** confiar en el `organization_id` que venga del cliente en el body de la request; se toma siempre del usuario autenticado.
- Estrategia elegida para el MVP: **base y esquema compartidos con discriminador `organization_id`** (más simple y barato para empezar). El discriminador deja la puerta abierta a migrar a *schema-per-tenant* (django-tenants) más adelante para aislamiento más fuerte, si el volumen o la regulación lo exigen. Documenta esto en un ADR.

## Estructura de carpetas objetivo

```
repo/
  backend/
    config/
      settings/{base,dev,prod,test}.py
      urls.py  asgi.py  wsgi.py  celery.py
    core/                # base models, mixins, tenant middleware, permisos, utils
    apps/
      authentication/
      organizations/     # Organization, activación de módulos, config
      branches/          # Sucursales
      users/             # Usuario personalizado, roles, permisos
      customers/
      services/          # Servicios, empleados/profesionales
      scheduling/        # Horarios, disponibilidad, motor de disponibilidad
      appointments/      # Citas, estados, motor de reservas
      payments/
      notifications/     # Modelo, plantillas, proveedores, centro interno
      documents/
      reports/
      audit/
      integrations/      # API pública para terceros: API keys, clientes OAuth, scopes, webhooks
      modules/
        moto/
        laboratory/
        store/
        legal/
    manage.py
    pyproject.toml
    Dockerfile
  frontend/
    src/{api,components,features,routes,hooks,lib,types}/
    ...
  docs/                  # ADRs, ERD, contratos de API, decisiones
  docker-compose.yml
  CLAUDE.md
  README.md
```

## Convenciones de trabajo (cómo debes comportarte)

- Trabaja **una fase a la vez**. No adelantes trabajo de fases futuras.
- Antes de escribir código, di brevemente qué archivos vas a crear o modificar.
- Entrega migraciones junto con los modelos. Nunca dejes migraciones pendientes.
- Cada fase incluye **tests automatizados** y termina **funcional**. No avances si los tests fallan.
- No elimines funcionalidad existente sin explicarlo. Mantén compatibilidad con esta arquitectura.
- Al final de cada fase: corre la suite de tests, resume qué se hizo, explica **cómo ejecutarlo y probarlo**, y propón un commit con mensaje convencional.
- Mantén un `docs/` con las decisiones (ADRs) y el modelo de datos actualizado.

## Baseline de seguridad (aplica desde la Fase 2)

Hashing de contraseñas (Django por defecto), control de permisos por rol, protección CSRF/XSS/SQLi (usa el ORM, nunca SQL crudo interpolado), validación de datos en serializers, rate limiting en auth, expiración y rotación de sesiones/tokens, recuperación de contraseña, y registro de auditoría para acciones sensibles. Los registros de auditoría no deben poder borrarse desde la app.

## Estándares y prácticas obligatorias (transversales a todas las fases)

Estos estándares aplican a **todo** el código y a todas las fases. No son opcionales.

### Clean Code y SOLID

- **SRP:** cada clase/función tiene una sola razón de cambio. Funciones cortas, un solo nivel de abstracción, sin efectos colaterales ocultos.
- **OCP / LSP / ISP / DIP:** extiende sin modificar; depende de abstracciones (interfaces/protocolos), no de implementaciones. Los proveedores (email/SMS/WhatsApp, pagos) se inyectan detrás de interfaces.
- **Clean Code:** nombres intención-reveladores, cero números/strings mágicos (usa constantes/enums), sin código muerto ni comentarios que expliquen "qué" (el código lo dice; los comentarios explican "por qué"). **DRY, KISS, YAGNI.**
- **Separación por capas:** vistas/serializers (I/O) → servicios/casos de uso (reglas de negocio) → repositorios/ORM (persistencia). **Ninguna regla de negocio en vistas ni serializers.**

### Calidad del producto — ISO/IEC 25010

Diseña y evalúa contra las 8 características del modelo de calidad, y en cada fase indica cómo se atienden las relevantes:

1. **Adecuación funcional** — completitud y corrección respecto al spec (verificado por tests de aceptación).
2. **Eficiencia de desempeño** — tiempos de respuesta, consultas sin N+1, índices adecuados, paginación.
3. **Compatibilidad** — API versionada, contratos estables, interoperabilidad.
4. **Usabilidad** — UI clara, accesible, responsive; mensajes de error entendibles.
5. **Fiabilidad** — manejo de errores, tolerancia a fallos, recuperación (backups probados).
6. **Seguridad** — confidencialidad, integridad, no repudio (auditoría), autenticación y autorización.
7. **Mantenibilidad** — modularidad, reusabilidad, analizabilidad, testeabilidad, baja complejidad ciclomática.
8. **Portabilidad** — contenerización, configuración por variables de entorno, independencia de infraestructura.

Registra en `docs/quality-iso25010.md` los objetivos de calidad medibles (p. ej. cobertura ≥ 80%, p95 de endpoints < 300 ms, complejidad ciclomática por función ≤ 10).

### Seguridad de la información — ISO/IEC 27001 (controles técnicos del Anexo A)

Alinea los controles técnicos aplicables (aunque la certificación es organizacional, el software debe soportarlos). Mantén un **SoA técnico** en `docs/security-iso27001.md` mapeando qué implementa cada control:

- **A.5/A.8 Control de acceso e identidad:** RBAC, mínimo privilegio, gestión de credenciales, MFA preparado.
- **A.8 Criptografía:** cifrado en tránsito (TLS) y en reposo para datos sensibles; hashing de contraseñas; gestión de secretos fuera del código.
- **A.8 Registro y monitoreo:** logs de eventos y auditoría inmutable (ver RFC 5424 abajo).
- **A.8 Desarrollo seguro:** validación de entradas, protección OWASP Top 10 (inyección, XSS, CSRF, SSRF, deserialización, etc.), revisión de dependencias.
- **A.8 Respaldo:** backups cifrados con restauración probada.
- **A.5 Gestión de incidentes:** logging estructurado + hook de alertas para detectar y responder.
- **Privacidad por defecto y por diseño:** separación de datos por tenant, retención y eliminación segura, exportación.

### Gobierno de TI — COBIT 2019

Marco complementario a ISO 27001 (controles técnicos) para dejar evidencia de gobierno de TI, sin implicar un proceso de auditoría formal:

- **APO (Align, Plan, Organize):** el roadmap por fases (`docs/roadmap.md`, `docs/checklist.md`) es el mecanismo de planificación y gestión de riesgo (APO12); no se avanza de fase sin objetivos de calidad medibles cumplidos.
- **BAI (Build, Acquire, Implement):** gestión de cambios (BAI06) vía control de versiones y migraciones versionadas; gestión de la configuración (BAI10) vía `config/settings/{base,dev,prod,test}.py` y variables de entorno.
- **DSS (Deliver, Service, Support):** gestión de operaciones e incidentes (DSS01/DSS02) soportada por logging RFC 5424 y `AuditLog`; continuidad (DSS04) soportada por `docs/backup-strategy.md`.
- **MEA (Monitor, Evaluate, Assess):** el checklist de fases junto con `docs/quality-iso25010.md` y `docs/security-iso27001.md` son el mecanismo de monitoreo de desempeño y conformidad (MEA01/MEA03).

### Ciberseguridad — NIST CSF 2.0

Marco complementario de gestión de riesgo de ciberseguridad, mapeado a las 6 funciones:

- **Govern:** RBAC y mínimo privilegio (`docs/auth-rbac.md`).
- **Identify:** ERD como inventario de activos de información (`docs/erd.md`); clasificación de datos sensibles (laboratorio, legal).
- **Protect:** hashing de contraseñas (alineado a NIST SP 800-63B para políticas de credenciales), JWT con rotación, TLS, cifrado de backups, validación de entrada — mismos controles del SoA ISO 27001.
- **Detect:** logging estructurado RFC 5424 + correlation-id, hook a monitoreo/alertas (Fase 14).
- **Respond:** taxonomía de excepciones (`docs/error-handling.md`) y `AuditLog` inmutable como base de investigación de incidentes.
- **Recover:** `docs/backup-strategy.md` con restauración probada periódicamente.

### UX, accesibilidad y modo claro/oscuro

Toda interfaz (React) sigue estos principios, verificados en cada fase que entregue pantallas:

- **Modo claro/oscuro obligatorio desde el primer componente:** sistema de diseño basado en **tokens de color** (CSS variables / theme provider), nunca colores hardcodeados en componentes. El tema (claro/oscuro/sistema) respeta `prefers-color-scheme` con override manual persistido; ningún color se define solo para un modo.
- **Accesibilidad (WCAG 2.1 AA):** contraste mínimo 4.5:1 en texto, navegación completa por teclado en flujos críticos (agenda, reserva, formularios), `label` asociado a cada campo, foco visible, texto alternativo en iconografía funcional.
- **Heurísticas de usabilidad (Nielsen):** visibilidad del estado del sistema (loading/success/error claros), prevención de errores (confirmación en acciones destructivas), consistencia de patrones entre módulos, mensajes de error sin jerga técnica (alineado con `docs/error-handling.md`).
- **Responsive por defecto:** mobile-first en flujos de cara al cliente (reserva online, portal de cliente); desktop-first aceptable en pantallas operativas internas (agenda de staff, reportes), ambas usables en todo el rango de viewport soportado.
- **Design system documentado antes de escalar:** tokens mínimos de color, espaciado y tipografía definidos en `frontend/src/` antes de multiplicar pantallas, para que cada pantalla nueva reutilice el sistema en vez de reinventar estilos.

### Logging estructurado — RFC 5424 (Syslog)

- Usa los **8 niveles de severidad** RFC 5424: `emergency(0)`, `alert(1)`, `critical(2)`, `error(3)`, `warning(4)`, `notice(5)`, `info(6)`, `debug(7)`. Mapea el logging de la app a estos niveles.
- **Logs estructurados** (JSON) con campos mínimos: timestamp ISO-8601, severidad, servicio, `organization_id`, `user_id`, `request_id`/correlation-id, evento y datos estructurados. **Nunca** registres contraseñas, tokens, PII innecesaria ni resultados clínicos en claro.
- Correlation ID por request propagado a tareas Celery. La **auditoría** (`AuditLog`) es un canal aparte, inmutable, para acciones sensibles.

### Manejo de errores

- **Taxonomía de excepciones** propia del dominio (p. ej. `DomainError`, `ValidationError`, `PermissionDenied`, `ConflictError`, `NotFoundError`) mapeada a códigos HTTP consistentes.
- **Exception handler global de DRF** que devuelve un formato de error uniforme (`{code, message, details, request_id}`), registra con la severidad correcta y **no filtra** stack traces ni datos sensibles al cliente.
- Falla rápido y explícito; nunca silencies excepciones con `except: pass`. Errores esperados se manejan; los inesperados se registran como `error`/`critical` y se alertan.

### Estrategia de pruebas — TDD, ISTQB, caja negra y caja blanca

- **TDD (Red-Green-Refactor):** para toda lógica de negocio, escribe primero el test que falla, luego el código mínimo para pasarlo, luego refactoriza. En cada fase, **muestra los tests antes o junto con la implementación**.
- **Niveles de prueba (ISTQB):** unitarias (componente) → integración → sistema (API E2E) → aceptación (criterios del spec). Respeta la **pirámide de pruebas** (muchas unitarias, menos E2E).
- **Técnicas de caja negra (basadas en especificación):** particiones de equivalencia, análisis de valores límite (p. ej. duraciones, solapamientos de horario), tablas de decisión (reglas de disponibilidad/permisos) y transición de estados (estados de cita/orden/caso/muestra/pedido).
- **Técnicas de caja blanca (basadas en estructura):** cobertura de sentencias y de ramas; apunta a cubrir los caminos críticos de los motores de disponibilidad y reservas.
- **Cobertura mínima:** ≥ 80% global y ≥ 90% en los motores de disponibilidad/reservas, pagos y control de acceso.
- **Gestión de defectos y criterios (ISTQB):** define criterios de entrada/salida por fase; un defecto encontrado se reproduce con un test antes de corregirse (test de regresión).
- Documenta el **Plan Maestro de Pruebas** en `docs/test-plan.md` (niveles, técnicas, criterios, cobertura, datos de prueba).

## API pública de integración (para terceros)

La plataforma expone **dos superficies de API separadas**, que no deben mezclarse:

- **API interna** (`/api/...`): la consume tu propio frontend (React). Auth por JWT de sesión de usuario.
- **API pública de integración** (`/api/public/v1/...`): la consumen **sistemas de terceros** que quieran integrarse. Es un producto en sí mismo y se diseña con contrato estable y compatibilidad hacia atrás.

Reglas de la API pública:

- **Versionado explícito** en la ruta (`/api/public/v1/`). Nunca rompas un contrato publicado; los cambios incompatibles van a una versión nueva, con **política de deprecación** documentada.
- **Autenticación para terceros:** **API keys** por integración (con secreto hasheado, prefijo visible y rotación) para casos servidor-a-servidor simples, y **OAuth2 client-credentials** para integraciones más completas. La autenticación de terceros es independiente del login de usuarios.
- **Multitenancy respetado:** cada credencial de integración pertenece a **una organización**; solo puede leer/escribir datos de esa organización. Se toma el tenant de la credencial, nunca del payload.
- **Scopes / permisos granulares:** cada credencial declara alcances (p. ej. `customers:read`, `appointments:write`, `availability:read`, `webhooks:manage`) y solo puede lo autorizado. Mínimo privilegio también aquí.
- **Rate limiting y cuotas por cliente** (por API key/plan), independientes del throttling de la API interna. Devuelve cabeceras de límite (`X-RateLimit-*`) y `429` con `Retry-After`.
- **Contrato robusto:** paginación consistente, filtros y ordenamiento estándar, **idempotencia** en operaciones de escritura (cabecera `Idempotency-Key`), formato de error uniforme (el mismo del estándar de manejo de errores), y respuestas versionadas.
- **Webhooks salientes:** los terceros pueden suscribirse a eventos (p. ej. `appointment.created`, `appointment.cancelled`, `payment.registered`, `order.status_changed`, `lab_result.validated`) con entrega firmada (HMAC), reintentos con backoff y registro de entregas. Reutiliza Celery.
- **Documentación OpenAPI 3** autogenerada (`drf-spectacular`) publicada en un portal (Swagger UI/Redoc), con guía de autenticación, scopes, límites y ejemplos. Provee un **entorno sandbox** con datos demo.
- **Observabilidad y seguridad:** cada request de integración se loguea (RFC 5424) con el `client_id`/`key_id` y correlation-id, y las acciones sensibles quedan en auditoría. Aplica los mismos controles ISO 27001 (TLS, validación, OWASP).
- **Preparado para suscripciones:** los límites de la API pública (rate, scopes, webhooks) deben poder atarse al plan del futuro modelo de suscripción.

## Una fase está terminada cuando:

1. El código sigue esta arquitectura, respeta **SOLID/Clean Code** y las capas (sin lógica de negocio en vistas).
2. Se siguió **TDD**; hay tests unitarios, de integración y E2E que pasan, con **técnicas de caja negra y caja blanca** aplicadas y **cobertura** dentro del umbral (≥ 80%, ≥ 90% en componentes críticos).
3. Los tests incluyen los casos clave y el **aislamiento multitenant** donde aplique; los defectos corregidos tienen test de regresión.
4. Hay migraciones aplicadas y los endpoints/pantallas funcionan de extremo a extremo.
5. El **manejo de errores** es uniforme y el **logging** cumple RFC 5424 (estructurado, con severidad y correlation-id, sin datos sensibles).
6. Se respetan los **controles ISO 27001** y **NIST CSF** aplicables, se consideraron los atributos de calidad **ISO 25010** relevantes, la fase respeta el marco de gobierno de TI (**COBIT**) del proyecto, y toda pantalla nueva cumple los principios de **UX/accesibilidad (WCAG 2.1 AA)** y soporta **modo claro/oscuro**.
7. Actualizaste `docs/` (incluidos `quality-iso25010.md`, `security-iso27001.md`, `test-plan.md` cuando aplique) y el seed/demo.
8. Explicaste **cómo ejecutarlo y probarlo** y propusiste un commit convencional.
