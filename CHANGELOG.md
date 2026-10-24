# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo, orientados a negocio (qué cambia para quien usa o integra la plataforma, no el detalle técnico línea por línea — ese vive en `docs/checklist.md` y en el historial de commits).

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto avanza por fases numeradas (ver `docs/roadmap.md`), no por versiones semánticas todavía — mientras no haya un primer release público, los cambios se agrupan bajo `[Unreleased]`.

## [Unreleased]

### Security

- Corregido el único modelo de negocio que no respetaba el aislamiento automático entre empresas (organizaciones): el registro de auditoría (`AuditLog`) ahora filtra automáticamente por organización igual que el resto del sistema, en vez de depender de que cada pantalla lo filtrara a mano. Hoy no había ninguna fuga real porque la única pantalla que lo usa ya filtraba correctamente, pero cualquier código nuevo que se olvidara de hacerlo habría quedado expuesto.
- Si la plataforma se despliega a producción sin configurar la clave secreta o la contraseña de la base de datos, ahora el sistema se niega a arrancar en vez de arrancar en silencio con valores de desarrollo (adivinables).
- Agregado un toggle manual de tema claro/oscuro (antes solo se seguía la preferencia del sistema operativo, sin poder anularla desde la app).

### Added

- **Gestión de credenciales para integraciones de terceros** (Fase 12B, en curso): las empresas ahora pueden crear y revocar sus propias API Keys y clientes OAuth2 desde `/api/integrations/`, para que sistemas externos (ERPs, herramientas de terceros) puedan conectarse a su cuenta sin compartir contraseñas de usuario. Cada credencial declara qué puede hacer (permisos granulares) y solo puede ver/modificar datos de la empresa que la creó — nunca de otra.
- **Límite de peticiones por organización** para la futura API pública de integración: cada empresa tiene una cuota de peticiones por minuto (configurable por plan a futuro), con cabeceras estándar que informan cuánto le queda y cuándo se resetea.
- **Reintentos seguros en la API pública (idempotencia):** cuando un sistema externo reintenta una operación de escritura tras un corte de red, la plataforma detecta el reintento y devuelve la misma respuesta en vez de repetir la acción — evita, por ejemplo, duplicar una cita o un pago por un reintento automático del lado del cliente.
- **Consulta pública de clientes, servicios y disponibilidad** (Fase 12B): los sistemas externos autorizados ya pueden, a través de la API pública, listar y dar de alta clientes, consultar el catálogo de servicios activos, y ver qué horarios están disponibles para un servicio en una fecha dada — sin exponer nunca a qué cliente pertenece un horario ocupado, solo si está libre.
- **Reservar y cancelar citas desde la API pública** (Fase 12B): un sistema externo autorizado ya puede agendar una cita para un cliente y cancelarla, con la misma protección contra choques de horario (dos reservas para el mismo turno) que usa el personal interno, y con la misma protección contra duplicados por reintento de red (idempotencia) descrita arriba — aplicada aquí al escenario de mayor riesgo del sistema. Registrar un pago desde esa misma vía queda para el siguiente incremento.
- **Plan documentado (sin implementar todavía) para el portal de autoservicio de clientes:** se identificó que, aunque el rol "Cliente" existe desde el inicio del proyecto, hoy ningún cliente final puede reservar, cancelar o reprogramar una cita por sí mismo — solo el personal de la empresa puede hacerlo por él. Se documentó el diseño (login sin contraseña por código enviado al email, en vez de un sistema de contraseñas nuevo) y el plan de implementación en `docs/superpowers/plans/2026-08-19-fase15-portal-clientes.md`, pendiente de una decisión de producto antes de empezar a construirlo.

### Fixed

- Corregido, antes de que llegara a producción, un defecto de diseño en el plan de la API pública que habría dejado sin efecto la protección contra reintentos duplicados (idempotencia) justo en el recurso de citas — el escenario de mayor riesgo (una cita duplicada por un reintento de red). Se detectó durante la implementación de esa protección, no en revisión posterior.
- Corregidas violaciones de estilo de código (líneas demasiado largas) que habían quedado sin detectar en trabajo previo de integraciones, y se endureció una prueba automatizada que verificaba un fallo de autenticación de forma demasiado genérica.

### Changed

- Actualizada la migración de dependencias de seguridad (Django y librerías relacionadas) — trabajo en curso, documentado en detalle en `docs/security-iso27001.md` y `docs/roadmap.md`.
- Verificado de punta a punta (compilación, análisis de estilo y pruebas automatizadas) que la actualización de dependencias del frontend hecha anteriormente no rompió ninguna pantalla existente — quedaba pendiente de confirmar.
