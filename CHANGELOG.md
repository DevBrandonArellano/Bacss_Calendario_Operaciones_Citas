# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo, orientados a negocio (qué cambia para quien usa o integra la plataforma, no el detalle técnico línea por línea — ese vive en `docs/checklist.md` y en el historial de commits).

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto avanza por fases numeradas (ver `docs/roadmap.md`), no por versiones semánticas todavía — mientras no haya un primer release público, los cambios se agrupan bajo `[Unreleased]`.

## [Unreleased]

> **Aviso sobre la Fase 12B (API pública):** las entradas de "Added" marcadas con *(Fase 12B)* describen trabajo hecho en un worktree aislado que **no está en `main`**: el commit `c52255d` eliminó el worktree y no existe ninguna rama con ese código (`backend/apps/integrations/` no existe). Hasta recuperarlo o rehacerlo, esas capacidades **no forman parte del producto actual**. Ver `docs/roadmap.md`.

### Security

- Producción ahora también rechaza arrancar si `DJANGO_SECRET_KEY` conserva el valor de plantilla (`change-me`) o el valor inseguro de desarrollo, no solo si falta.
- Corregida una fuga de contexto entre peticiones: el middleware de empresa no restauraba la organización activa al terminar cada request, por lo que el contexto de una petición podía filtrarse a la siguiente que corriera en el mismo hilo.
- Corregido el único modelo de negocio que no respetaba el aislamiento automático entre empresas (organizaciones): el registro de auditoría (`AuditLog`) ahora filtra automáticamente por organización igual que el resto del sistema, en vez de depender de que cada pantalla lo filtrara a mano. Hoy no había ninguna fuga real porque la única pantalla que lo usa ya filtraba correctamente, pero cualquier código nuevo que se olvidara de hacerlo habría quedado expuesto.
- Si la plataforma se despliega a producción sin configurar la clave secreta o la contraseña de la base de datos, ahora el sistema se niega a arrancar en vez de arrancar en silencio con valores de desarrollo (adivinables).
- Agregado un toggle manual de tema claro/oscuro (antes solo se seguía la preferencia del sistema operativo, sin poder anularla desde la app).

### Added

- **Dashboard rediseñado:** elige el período (hoy, 7 o 30 días, este mes) y compáralo con el anterior; indicadores con variación solo cuando existe una base real de comparación, gráficos de citas e ingresos con detalle al pasar el ratón o con el teclado, servicios más solicitados con porcentaje, próximas citas y accesos rápidos según tus permisos.
- **Agenda completa:** vistas por día (una columna por profesional), semana, mes, por profesional y lista; filtros por profesional, servicio y estado que se guardan en la dirección de la página; cita con alto proporcional a su duración, hora actual, huecos libres y horario laboral sombreado; clic en un hueco para crear la cita; panel con el detalle de cada cita y las acciones que su estado permite (confirmar, iniciar, completar, no asistió, reprogramar, cancelar) y edición de notas.
- **Nueva cita por grupos** (cliente, servicio, profesional, fecha y horario, información adicional) con resumen en vivo, horarios ocupados identificados, búsqueda de cliente sin cargar todo el listado y aviso claro si otra persona toma el horario mientras tanto.
- **Barra lateral colapsable**, barra superior con título de la pantalla, notificaciones sin leer y perfil.
- **Nueva imagen visual de la aplicación** (Tailwind CSS v4, tipografía Inter, iconos lucide): barra lateral de 256 px con navegación agrupada por sección y por módulo activo, barra superior de 64 px, menú desplegable en móvil, login en dos paneles y **Dashboard rediseñado** (rejilla de 12 columnas, indicadores con icono, gráficos en tarjetas de igual altura, estado de carga con esqueleto). Modo claro/oscuro intacto, con contrastes AA verificados. Las demás pantallas conservan su funcionamiento y se irán migrando por partes (`docs/design-system.md`).
- **Sitio público indexable**: página de inicio, `/funcionalidades` y `/para-negocios`, con un H1 propio por página, preguntas frecuentes y contenido que solo describe lo que el producto hace hoy. Cada página se genera como HTML estático en el build, con título, descripción, canonical, Open Graph y datos estructurados propios, más `robots.txt`, `sitemap.xml` y `llms.txt`. El área privada queda marcada `noindex`. No se garantiza ni se ha verificado ninguna indexación (`docs/seo.md`).
- Pruebas de regresión de SEO: metadatos únicos por página, robots/sitemap coherentes, jerarquía de encabezados sin saltos, JSON-LD válido y hidratación sin desajustes (88 pruebas de frontend en total).
- **Integración continua (CI) y pipeline Jenkins:** cada cambio pasa automáticamente por lint, pruebas y build, tanto en GitHub Actions (backend contra PostgreSQL y Redis reales) como en un `Jenkinsfile` con ejecución selectiva (solo corre backend o frontend según lo que cambió), caché, notificaciones (GitHub, Telegram, correo) y estrategia de ramas `feature/*` → `staging` → `main`. Guía en `docs/jenkins/CONFIGURACION.md`.
- **Validación completa en Docker** (2026-10-24): 346 pruebas de backend y 263 de frontend en verde, cobertura de backend 91%, con PostgreSQL y Redis reales.
- **Primera ejecución de la suite completa contra PostgreSQL real** (2026-08-25): hasta entonces las pruebas del backend solo se habían verificado de forma estática. Los defectos que salieron están en "Fixed".
- **Evaluación de despliegue en Vercel** (`docs/adr-002-viabilidad-despliegue-vercel.md`): propuesta, no implementada. Concluye que se puede, pero exige reescribir Celery Beat como cron jobs y abandonar la portabilidad "cualquier proveedor con Docker" de ADR-000.
- **Gestión de credenciales para integraciones de terceros** (Fase 12B, en curso): las empresas ahora pueden crear y revocar sus propias API Keys y clientes OAuth2 desde `/api/integrations/`, para que sistemas externos (ERPs, herramientas de terceros) puedan conectarse a su cuenta sin compartir contraseñas de usuario. Cada credencial declara qué puede hacer (permisos granulares) y solo puede ver/modificar datos de la empresa que la creó — nunca de otra.
- **Límite de peticiones por organización** para la futura API pública de integración: cada empresa tiene una cuota de peticiones por minuto (configurable por plan a futuro), con cabeceras estándar que informan cuánto le queda y cuándo se resetea.
- **Reintentos seguros en la API pública (idempotencia):** cuando un sistema externo reintenta una operación de escritura tras un corte de red, la plataforma detecta el reintento y devuelve la misma respuesta en vez de repetir la acción — evita, por ejemplo, duplicar una cita o un pago por un reintento automático del lado del cliente.
- **Consulta pública de clientes, servicios y disponibilidad** (Fase 12B): los sistemas externos autorizados ya pueden, a través de la API pública, listar y dar de alta clientes, consultar el catálogo de servicios activos, y ver qué horarios están disponibles para un servicio en una fecha dada — sin exponer nunca a qué cliente pertenece un horario ocupado, solo si está libre.
- **Reservar y cancelar citas desde la API pública** (Fase 12B): un sistema externo autorizado ya puede agendar una cita para un cliente y cancelarla, con la misma protección contra choques de horario (dos reservas para el mismo turno) que usa el personal interno, y con la misma protección contra duplicados por reintento de red (idempotencia) descrita arriba — aplicada aquí al escenario de mayor riesgo del sistema. Registrar un pago desde esa misma vía queda para el siguiente incremento.
- **Plan documentado (sin implementar todavía) para el portal de autoservicio de clientes:** se identificó que, aunque el rol "Cliente" existe desde el inicio del proyecto, hoy ningún cliente final puede reservar, cancelar o reprogramar una cita por sí mismo — solo el personal de la empresa puede hacerlo por él. Se documentó el diseño (login sin contraseña por código enviado al email, en vez de un sistema de contraseñas nuevo) y el plan de implementación en `docs/superpowers/plans/2026-08-19-fase15-portal-clientes.md`, pendiente de una decisión de producto antes de empezar a construirlo.

### Fixed

- **Agenda:** mostraba solo las primeras 20 citas del período (una semana o un mes con más citas quedaba incompleto) y resolvía el nombre de clientes y servicios con una sola página de resultados, por lo que podían aparecer identificadores en lugar de nombres.
- **Agenda:** ofrecía «Reprogramar» en citas pendientes, acción que el sistema rechaza; ahora solo se ofrece cuando es válida.
- **Dashboard:** «citas de hoy» usaba la fecha del servidor, de modo que por la noche (hora de Ecuador) mostraba el día siguiente; ahora usa la zona horaria de la empresa.
- Al abrir una cita desde un enlace dentro de la Agenda cambiando de fecha, el panel podía cerrarse solo; corregido con prueba de regresión.
- **Citas: el listado quedaba siempre vacío.** Una limpieza de código reciente eliminó por error la construcción por-petición de la consulta de citas, de modo que el listado y las acciones sobre citas existentes (confirmar, cancelar, reprogramar) no encontraban ninguna cita. Detectado al correr la suite completa en Docker (6 pruebas fallaban) y corregido antes de llegar a producción.
- Formato de código unificado (`ruff format`) en 18 archivos, que hacía fallar la verificación de estilo del CI.
- Encontrados al correr la suite contra PostgreSQL real (commit `776a113`):
  - **Disponibilidad:** el motor no fijaba su propia empresa al usarse fuera de una petición web (por ejemplo desde tareas en segundo plano), con riesgo de resultados vacíos.
  - **Montos incorrectos:** en Taller y Tienda, si el precio llegaba como texto el subtotal se repetía como cadena en vez de multiplicarse; además el total de una orden de trabajo podía calcularse sobre una lista desactualizada de ítems.
  - **Límite de intentos de login:** no leía la configuración en tiempo de ejecución, así que cambiarla no tenía efecto.
  - **Documentos:** la subida de archivos fallaba por una longitud máxima insuficiente del nombre guardado.
  - **Legal:** la fecha de apertura de un caso se guardaba como fecha-hora en un campo de solo fecha, rompiendo la respuesta de la API.
  - **Notificaciones y datos demo:** referencias a un acceso sin filtro por empresa que no existía, en 253 lugares y con código de producción incluido.
- Corregido, antes de que llegara a producción, un defecto de diseño en el plan de la API pública que habría dejado sin efecto la protección contra reintentos duplicados (idempotencia) justo en el recurso de citas — el escenario de mayor riesgo (una cita duplicada por un reintento de red). Se detectó durante la implementación de esa protección, no en revisión posterior.
- Corregidas violaciones de estilo de código (líneas demasiado largas) que habían quedado sin detectar en trabajo previo de integraciones, y se endureció una prueba automatizada que verificaba un fallo de autenticación de forma demasiado genérica.

### Changed

- Paleta y estilo visual unificados (claro y oscuro) con colores de estado de cita consistentes en toda la aplicación; revisada con una auditoría automática de accesibilidad sin hallazgos. Dos grises/fondos se ajustaron respecto a la propuesta para alcanzar el contraste mínimo.
- La respuesta de la API de citas incluye ahora los nombres del cliente, servicio, profesional y sucursal; la lista de notificaciones admite `?unread=true`; nuevo `GET /api/users/me/` y `PATCH /api/appointments/{id}/notes/`.
- Actualizada la migración de dependencias de seguridad (Django y librerías relacionadas) — trabajo en curso, documentado en detalle en `docs/security-iso27001.md` y `docs/roadmap.md`.
- Verificado de punta a punta (compilación, análisis de estilo y pruebas automatizadas) que la actualización de dependencias del frontend hecha anteriormente no rompió ninguna pantalla existente — quedaba pendiente de confirmar.
