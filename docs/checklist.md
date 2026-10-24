# Checklist de ejecución — Plataforma Multinegocio

Roadmap detallado de todas las fases del proyecto, con cada entregable como ítem verificable. Se actualiza al cierre de cada fase (marcar `[x]` solo cuando el ítem está hecho, probado y con tests en verde — no antes). Este archivo es la fuente de verdad de "dónde vamos" entre sesiones.

**Regla de oro (de `CLAUDE.md`):** una fase a la vez; no se avanza a la siguiente sin visto bueno explícito del usuario y sin que los tests de la fase actual pasen.

---

## Fase 0 — `CLAUDE.md` (contexto permanente)

- [x] Crear `CLAUDE.md` en la raíz con rol, visión, stack, principios de arquitectura, reglas de multitenancy, estructura de carpetas, convenciones y estándares transversales.

## Fase 1 — Arquitectura y diseño

- [x] `docs/adr-000-stack-tecnologico.md`
- [x] `docs/adr-001-estrategia-multitenant.md`
- [x] `docs/erd.md` (modelo de datos completo, core + 4 módulos, Mermaid ER)
- [x] `docs/api-interna.md` (contrato API interna)
- [x] `docs/public-api.md` (contrato API pública de integración)
- [x] `docs/module-system.md` (diseño sistema de módulos)
- [x] `docs/availability-engine.md` (diseño motor de disponibilidad)
- [x] `docs/booking-engine.md` (diseño motor de reservas + concurrencia)
- [x] `docs/auth-rbac.md` (roles y matriz de permisos)
- [x] `docs/security-strategy.md`, `docs/backup-strategy.md`, `docs/test-strategy-overview.md`, `docs/deployment-strategy.md`
- [x] `docs/quality-iso25010.md`
- [x] `docs/security-iso27001.md`
- [x] `docs/logging.md`
- [x] `docs/error-handling.md`
- [x] `docs/test-plan.md`
- [x] `docs/roadmap.md`
- [x] Esqueleto vacío de carpetas (`backend/`, `frontend/`, `docs/`)
- [x] **Visto bueno del usuario para pasar a Fase 2** (recibido 2026-08-15, tras incorporar COBIT/NIST/UX a `CLAUDE.md`)

## Fase 2 — Core (proyecto, tenancy, usuarios, roles, permisos)

- [x] Scaffolding Django + DRF: `config/settings/{base,dev,prod,test}.py`
- [x] PostgreSQL + Redis/Celery configurados
- [x] `docker-compose` de desarrollo
- [x] `core/`: `TimeStampedModel`, `SoftDeleteModel`, `TenantAwareModel`
- [x] Manager/queryset con filtro automático por `organization`
- [x] Middleware que resuelve la organización del usuario autenticado
- [x] App `organizations`: modelo `Organization`, activación de módulos, configuración (zona horaria, moneda, formato fecha, feriados)
- [x] App `branches`: sucursales
- [x] App `users`: modelo de usuario personalizado, roles (Superadmin, Admin empresa, Recepción, Profesional, Cliente), permisos, RBAC en DRF
- [x] App `authentication`: registro/login/logout, JWT + refresh, recuperación de contraseña, rate limiting en auth
- [x] App `audit`: modelo `AuditLog` (inmutable) + utilidades de registro
- [x] Comando de management de seed/demo (`seed_rbac` + `seed_demo`)
- [x] Andamiaje de calidad: pytest + pytest-django, cobertura, ruff, mypy, pre-commit (ruff verificado en verde localmente)
- [x] Exception handler global DRF (formato de error uniforme)
- [x] Logging estructurado RFC 5424 con correlation-id
- [x] Tests escritos: aislamiento multitenant (Empresa A nunca ve datos de Empresa B), login/logout, permisos por rol (caja negra + caja blanca)
- [ ] Suite de tests corrida y en verde contra PostgreSQL real, con cobertura medida (**pendiente**: se ejecuta al levantar Docker/Postgres — código y migraciones ya generados y listos)
- [x] Instrucciones de cómo levantar entorno, migrar y probar (`backend/README.md`)
- [ ] Commit convencional propuesto

## Fase 3 — Clientes

- [x] Modelo `Customer` scopeado por organización (y opcionalmente sucursal)
- [x] CRUD API DRF + pantallas frontend (lista, filtros, orden, formularios, confirmación en destructivas)
- [x] Búsqueda rápida (nombre, documento, teléfono, email)
- [x] Vista de historial del cliente (agrega lo que exista hasta el momento; queda lista para ampliarse en fases posteriores)
- [x] Tests backend escritos: CRUD, búsqueda, aislamiento por tenant, RBAC (`apps/customers/tests/`)
- [x] Tests frontend escritos y en verde: `CustomerListPage.test.tsx` (vitest)
- [x] Frontend scaffold (Vite+React+TS), login, rutas protegidas — verificado con `tsc -b`, `eslint`, `vitest run` en verde
- [x] Seed/demo actualizado con clientes ficticios (3 en Motors Ecuador, 2 en Laboratorio ABC)
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: se ejecuta junto con la de la Fase 2 al levantar Docker)
- [ ] Commit convencional propuesto

## Fase 4 — Servicios y profesionales

- [x] Modelo `Service` (duración configurable, precio, estado, sucursal(es))
- [x] Modelo `Employee`/profesional vinculado a `User`
- [x] Relación empleado ↔ servicios (`POST /api/employees/{id}/services/`)
- [x] CRUD API + UI para servicios y profesionales, con filtros y paginación
- [x] Tests backend escritos: CRUD, valores límite de duración/precio, unicidad por organización, aislamiento por tenant, RBAC (`apps/services/tests/`)
- [x] Tests frontend escritos y en verde: `ServiceListPage.test.tsx` (vitest, 4/4 tests totales)
- [x] Frontend: pantallas de Servicios y Profesionales verificadas con `tsc -b`, `eslint`, `vitest run` en verde
- [x] Seed/demo actualizado (3 servicios + 2 profesionales en Motors Ecuador; 2 servicios + 1 profesional en Laboratorio ABC)
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con Fases 2 y 3, al levantar Docker)
- [ ] Commit convencional propuesto

## Fase 5 — Agenda, disponibilidad y citas (núcleo)

- [x] Horarios: laboral de negocio y de empleado, descansos, días libres, vacaciones, feriados, ausencias, bloqueos manuales (`apps/scheduling`: `Schedule`, `AvailabilityBlock`)
- [x] Motor de disponibilidad (`apps/scheduling/engine.py`) implementado según `docs/availability-engine.md` (componente puro, sin efectos secundarios)
- [x] Motor de reservas (`apps/appointments/services.py`) implementado según `docs/booking-engine.md` (8 validaciones en orden)
- [x] Estrategia de concurrencia anti doble-reserva: locking pesimista (`select_for_update`) + `ExclusionConstraint` de PostgreSQL sobre rango de tiempo (defensa en dos capas, tal como documentado)
- [x] Modelo `Appointment` con estados y transiciones válidas (`VALID_TRANSITIONS`, `can_transition_to`)
- [x] Calendario frontend: vistas Día, Semana, Mes, Agenda por profesional (`CalendarPage.tsx`)
- [x] Reprogramación y cancelación de citas (con auditoría vía `TransitionAppointmentUseCase`)
- [x] Tests backend escritos: crear/confirmar/iniciar/completar/cancelar/reprogramar, transiciones válidas e inválidas (tabla de decisión), aislamiento por tenant, RBAC
- [x] Tests backend escritos: motor de disponibilidad excluye slots ocupados/fuera de horario/descansos/feriados/bloqueos, valores límite (slot que termina justo cuando empieza un descanso)
- [x] Test de concurrencia escrito: dos reservas simultáneas al mismo slot con hilos y conexiones de BD reales (`transaction=True`) — solo una debe tener éxito
- [x] Tests frontend escritos y en verde: `CalendarPage.test.tsx` (6/6 tests totales del frontend)
- [x] Frontend verificado con `tsc -b`, `eslint`, `vitest run` en verde
- [x] Seed/demo con horarios (lunes-viernes 09:00-18:00) y citas confirmadas de ejemplo
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real, incluido el test de concurrencia (**pendiente**: junto con las fases anteriores, al levantar Docker — el `ExclusionConstraint`/`btree_gist` solo puede validarse contra Postgres real)
- [x] **Corregido (2026-08-15, hallazgo previo a Fase 7):** `TenantAwareManager.get_queryset()` devuelve `.none()` sin contexto de tenant fijado, y encadenar `.filter()` sobre eso queda vacío para siempre — rompía `CreateAppointmentUseCase`/`TransitionAppointmentUseCase` fuera de una request HTTP (tests directos de servicio, `test_concurrency.py`, `seed_demo.py`), incluido el test de concurrencia mencionado arriba, que ni siquiera podía llegar a probar la condición de carrera. Arreglado con `core.context.tenant_scope` (context manager que fija y restaura el tenant), aplicado en `execute()`/`transition()`/`reschedule()`. Tests de regresión: `tests/test_tenant_context.py`, `apps/appointments/tests/test_tenant_context_regression.py`.
- [ ] Commit convencional propuesto

## Fase 6 — Notificaciones y recordatorios

- [x] Modelo `Notification` + sistema de plantillas (`NotificationTemplate`, con override por organización sobre plantilla global)
- [x] Abstracción de proveedor (interfaz común `NotificationProvider`, `apps/notifications/providers.py`)
- [x] Implementación real de email (SMTP, vía `django.core.mail`)
- [x] Stubs de WhatsApp y SMS detrás de la misma interfaz
- [x] Recordatorios programados con Celery + Redis (tarea periódica `notifications.send_appointment_reminders`, `CELERY_BEAT_SCHEDULE`)
- [x] Centro de notificaciones internas en la UI (`frontend/src/features/notifications/NotificationsPage.tsx`, ruta `/notificaciones`, enlace en `AppLayout`)
- [x] Bus de eventos de dominio mínimo (`core/events.py`, ya existía; se conectaron los handlers de `appointment.created/confirmed/cancelled/rescheduled` en `apps/notifications/handlers.py`)
- [x] Tests escritos: generación de notificaciones, renderizado de plantillas, disparo de tareas con proveedor mock (`apps/notifications/tests/`); frontend `NotificationsPage.test.tsx` (3/3)
- [x] Sistema de diseño con tokens de color (light/dark) introducido en `frontend/src/index.css` (`:root` + `prefers-color-scheme: dark`), reemplazando los colores hardcodeados existentes, por el nuevo estándar UX de `CLAUDE.md`
- [x] Frontend verificado con `tsc -b`, `eslint .`, `vitest run` en verde (9/9 tests totales del frontend)
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con las fases anteriores, al retomar Docker — por ahora solo se verificó `ruff check` en verde y la colección de los tests nuevos sin errores de import/registro)
- [ ] Commit convencional propuesto

## Fase 7 — Pagos

- [x] Modelo `Payment` (`apps/payments/models.py`): métodos (`cash|transfer|card|other`), estado de la transacción individual (`pending|paid|refunded`; ver nota de diseño en el propio modelo sobre por qué no incluye `partial` a nivel de transacción)
- [x] Soporte de pagos parciales: `Appointment.payment_status` (`unpaid|partial|paid|refunded`) se recalcula como agregado de los `Payment` de la cita (`apps/payments/services.py::_recompute_appointment_payment_status`); historial por cliente/cita disponible vía `GET /api/payments/?customer=&appointment=`
- [x] Vinculación con citas (`Payment.appointment`, nullable — también permite pagos sin cita asociada)
- [x] Lógica financiera en `CreatePaymentUseCase`/`RefundPaymentUseCase` (`apps/payments/services.py`), nunca en vistas/serializers
- [x] Registro en auditoría (`AuditLog` vía `apps.audit.services.log_action`, en alta y en reembolso)
- [x] Tests escritos: pago completo, pago parcial (incluye dos pagos parciales que completan el precio), reembolso, validaciones (cliente inexistente, cita de otro cliente, monto no positivo, doble reembolso), API (creación, reembolso, aislamiento entre organizaciones) — `apps/payments/tests/`
- [x] Seed/demo actualizado (`seed_demo.py`: pago completo en la primera cita, pago parcial en la segunda, por organización)
- [x] Frontend: pantalla `/pagos` (`PaymentsPage.tsx`) — buscar/seleccionar cliente, registrar pago con cita opcional, historial filtrable por estado, reembolso; historial de cliente (`CustomerHistoryPage.tsx`) ahora muestra los pagos reales (antes era un stub que devolvía `[]`) con enlace directo a registrar un pago nuevo
- [x] Frontend verificado con `tsc -b`, `eslint .`, `vitest run` en verde (13/13 tests totales del frontend)
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con las fases anteriores, al retomar Docker)
- [ ] Commit convencional propuesto

## Fase 8 — Módulo Taller de motos

- [x] Infraestructura del sistema de módulos (primera vez que se usa, ver `docs/module-system.md`): `core/modules/registry.py` (registro central) y `core/permissions.py::ModuleActiveRequired` (permission class que responde 404, no 403, si el módulo no está activo)
- [x] Modelos: `Motorcycle`, `VehicleHistory`, `WorkOrder`, `WorkOrderItem` (`apps/modules/moto/models.py`) — `WorkOrderItem` no tiene `organization_id` en `docs/erd.md`, pero se agregó igual por la regla #1 no negociable de `CLAUDE.md` (ver nota de diseño en el propio modelo)
- [x] Estados de la orden de trabajo con transiciones (`WorkOrderStatus`, `VALID_WORK_ORDER_TRANSITIONS`); `Motorcycle` no tiene campo `status` propio (no está en `docs/erd.md` — el estado de servicio vive en la orden de trabajo, no en el vehículo)
- [x] API: `apps/modules/moto/{views,urls}.py` bajo `/api/modules/moto/` — CRUD de motos, historial vehicular (`GET/POST .../history/`), órdenes de trabajo con transición explícita (`POST .../transition/`) e ítems (`GET/POST .../items/`, recalculan el total)
- [x] Lógica en casos de uso (`apps/modules/moto/services.py`: `CreateWorkOrderUseCase`, `TransitionWorkOrderUseCase`, `AddWorkOrderItemUseCase`), con `tenant_scope` desde el inicio (patrón corregido en Fase 5/7) y auditoría
- [x] Tests escritos: módulo no accesible sin activación (404), CRUD de motos, aislamiento por tenant, tabla de decisión de transiciones válidas/inválidas, cálculo de subtotal/total — `apps/modules/moto/tests/`
- [x] Seed/demo actualizado: dos motos y una orden de trabajo con ítems para "Motors Ecuador" (que ya tenía el módulo `moto` activo desde la Fase 2 — el checklist original decía "MotoCenter" como nombre de referencia, se usó la organización ya existente en vez de crear una tercera)
- [x] Frontend: `frontend/src/features/moto/` — `MotorcycleListPage`/`MotorcycleFormPage`/`MotorcycleHistoryPage` (CRUD de motos + historial vehicular) y `WorkOrderListPage`/`WorkOrderDetailPage` (crear orden, botones de transición solo hacia estados válidos según `VALID_WORK_ORDER_TRANSITIONS`, agregar ítems con recálculo de total); rutas `/motos`, `/motos/nueva`, `/motos/:id/editar`, `/motos/:id/historial`, `/ordenes-trabajo`, `/ordenes-trabajo/:id`; enlaces "Motos" y "Órdenes de trabajo" en `AppLayout`
- [x] Nav/rutas dinámicas por módulo activo (`docs/module-system.md`): `AuthContext` consulta `GET /api/organizations/me/` y expone `activeModules`/`hasModule()`; `AppLayout` oculta los enlaces de un módulo inactivo; `routes/ModuleRoute.tsx` redirige a `/citas` si se navega directo a una ruta de un módulo inactivo (defensa adicional al 404 del backend)
- [x] Frontend verificado con `tsc -b`, `eslint .`, `vitest run` en verde (22/22 tests totales del frontend)
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con las fases anteriores, al retomar Docker)
- [ ] Commit convencional propuesto

## Deuda técnica — Auditoría WCAG 2.1 AA de pantallas existentes

- [x] Contraste de color de todos los pares de tokens (`frontend/src/index.css`) verificado por cálculo real (fórmula de luminancia relativa WCAG), no solo visual: todos los pares texto/fondo, badge y estado usados en la app cumplen ≥ 4.5:1 en modo claro y oscuro — no había regresión de contraste, el sistema de tokens introducido en Fase 6 ya era correcto
- [x] Foco atrapado en diálogos modales (`ConfirmDialog`, `CancelAppointmentDialog`, `RescheduleDialog`): no cerraban con Escape, no atrapaban `Tab` dentro del modal (se podía tabular hacia contenido oculto detrás del backdrop) ni devolvían el foco al elemento que abrió el diálogo. Corregido con un hook compartido `frontend/src/hooks/useModalA11y.ts` (patrón de diálogo modal de WAI-ARIA APG), con tests propios (`useModalA11y.test.tsx`, 4 tests)
- [x] Indicador de página activa ausente en la navegación (`AppLayout`): usaba `<Link>` planas, sin `aria-current="page"` ni distinción visual — un usuario de teclado o lector de pantalla no podía saber en qué sección estaba. Corregido migrando a `<NavLink>` (que expone `aria-current="page"` automáticamente) más un estilo visual que no depende solo del color (negrita + subrayado, clase `.nav-link-active`)
- [x] Uso incorrecto de `disabled` para indicar selección en `CalendarPage` (botones de vista día/semana/mes/agenda): sacaba el botón "seleccionado" del orden de tabulación y no comunicaba el estado a lectores de pantalla. Corregido con `aria-pressed` + clase `.view-mode-active` (mismo criterio visual que el nav: negrita + subrayado, no solo color)
- [x] Verificado que no hay iconografía funcional sin texto alternativo (`grep` de `<svg>`/`<img>` en `frontend/src`: la UI es 100% texto, no aplica)
- [x] Tests actualizados/agregados: `CalendarPage.test.tsx` (nuevo caso `aria-pressed`), `AppLayout.test.tsx` (nuevo caso `aria-current`) — suite frontend completa en verde (28/28), `tsc -b` y `eslint .` sin errores
- [ ] Pendiente (no bloqueante): recorrido manual con lector de pantalla real (NVDA/VoiceOver) antes de Fase 14 — esta auditoría fue estática (código + cálculo de contraste), no con asistencia real

## Fase 9 — Módulo Laboratorio clínico

- [x] Modelos: `Patient`, `LabOrder`, `LabTest`, `Sample`, `LabResult` (`apps/modules/laboratory/models.py`) — el backend ya existía casi completo al retomar esta fase (código previo sin reflejar en este checklist); esta sesión lo auditó, cerró un gap de seguridad y construyó el frontend que faltaba
- [x] Estados del proceso con transiciones: 7 etapas lineales compartidas (`LAB_PROCESS_STAGE_ORDER`), `LabOrder.status` es un agregado (el cuello de botella entre sus `LabTest`, recalculado en cada transición — mismo patrón que `WorkOrder.total` de Fase 8)
- [x] Flujo de validación de resultados por profesional responsable, auditado: `ValidateLabResultUseCase` exige permiso granular `lab_results:write`, registra `validated_by_employee`/`validated_at` y deja entrada en `AuditLog`
- [x] Permisos estrictos y auditoría de accesos/cambios: permisos granulares `laboratory:read/write` (pipeline) separados de `lab_results:read/write` (valores clínicos) en `apps/users/permissions_catalog.py`; Recepción sin acceso al módulo por sensibilidad de datos clínicos (`docs/auth-rbac.md`)
- [x] **Corrección de seguridad encontrada en esta sesión:** `LabTestSerializer` anidaba el `LabResult` completo (incluido `result_value`) y solo exigía `laboratory:read`, sin pasar por el permiso granular `lab_results:read` ni quedar auditado — cualquiera con acceso de lectura al pipeline podía ver valores clínicos sin el permiso dedicado. Corregido con `LabResultRefSerializer` (solo expone `id`); el detalle completo se pide vía `GET /lab-results/{id}/`, que sí exige `lab_results:read` y audita el acceso
- [x] **Auditoría de lectura agregada:** `LabResultViewSet.retrieve`/`list` ahora registran `AuditAction.READ` (acción nueva agregada al catálogo, migración `apps/audit/migrations/0002_alter_auditlog_action.py`) — antes solo se auditaba la escritura, incumpliendo la nota de `docs/erd.md` ("todo acceso de lectura/escritura a LAB_RESULT queda auditado")
- [x] Tests: CRUD de pacientes, aislamiento por tenant, tabla de decisión de transiciones, flujo completo del pipeline vía API y por caso de uso, permiso de rol (Recepción sin acceso), auditoría de lectura de `LabResult` (2 tests nuevos), no filtrado de valores clínicos vía `LabTest` (1 test nuevo) — `apps/modules/laboratory/tests/`
- [x] Seed/demo: organización "Laboratorio ABC" con módulo `laboratory` activo, dos pacientes y un pedido con pruebas en distintas etapas del pipeline (`apps/organizations/management/commands/seed_demo.py`)
- [x] Frontend (nuevo en esta sesión, no existía): `frontend/src/features/laboratory/` — `PatientListPage`/`PatientFormPage` (CRUD de pacientes), `LabOrderListPage` (listar + crear pedido con pruebas dinámicas), `LabOrderDetailPage` (pruebas del pedido con enlace a gestión), `LabTestDetailPage` (pipeline completo: avanzar etapa, registrar muestra, registrar resultado, validar — pide el resultado clínico aparte vía el endpoint auditado y muestra un mensaje claro si el usuario no tiene `lab_results:read`, sin romper la pantalla); rutas `/laboratorio/pacientes`, `/laboratorio/pedidos`, `/laboratorio/pruebas/:id`; enlaces "Pacientes"/"Pedidos de laboratorio" en `AppLayout`, visibles solo si el módulo `laboratory` está activo
- [x] Frontend verificado con `tsc -b`, `eslint .`, `vitest run` en verde (33/33 tests totales del frontend, incluidos 5 nuevos del módulo laboratorio)
- [x] Backend verificado estáticamente sin Postgres real: `python manage.py check` sin errores, `makemigrations --check` sin cambios pendientes, `py_compile` de todos los archivos tocados sin errores de sintaxis
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con las fases anteriores, al retomar Docker — Docker Desktop no estaba corriendo en esta sesión y se decidió no levantarlo todavía)
- [ ] Commit convencional propuesto

## Fase 10 — Módulo Tienda / lanzamientos

- [x] Modelos: `Product`, `ProductVariant`, `Inventory`, `ProductLaunch`, `Order`, `OrderItem` (`apps/modules/store/models.py`) — construidos desde cero en esta sesión (a diferencia de Fase 9, este módulo no tenía código previo). `ProductVariant.stock` es el contador operativo que usa el motor de pedidos; `Inventory` es el desglose físico por sucursal documentado en `docs/erd.md`, independiente del contador operativo (nota de diseño en el propio modelo — mantenerlos sincronizados es una tarea manual de conteo, no automática en el MVP). `OrderItem` no tiene `organization_id` en el ERD, pero lo hereda igual por la regla #1 no negociable de `CLAUDE.md` (mismo criterio que `WorkOrderItem`, Fase 8)
- [x] Estados de pedido con transiciones: `pending → confirmed → paid → preparing → ready → delivered`, con rama de cancelación desde cualquier estado previo a `ready` inclusive (`VALID_ORDER_TRANSITIONS`, `apps/modules/store/models.py`) — mismo patrón que `AppointmentStatus`
- [x] API + UI: productos/variantes (CRUD), inventario por sucursal (CRUD), lanzamientos con preventa y cupo (CRUD + M2M a productos), pedidos (crear con ítems dinámicos + transición) — `apps/modules/store/{views,urls}.py` bajo `/api/modules/store/`, permisos `store:read/write` (`apps/users/permissions_catalog.py`, asignados a Admin/Recepción/Profesional — no es un módulo con datos sensibles como laboratorio, mismo criterio que `moto`)
- [x] **Control de stock:** `CreateOrderUseCase` valida stock suficiente por variante (sumando cantidades si la misma variante aparece en más de un ítem) antes de descontar, lanza `ConflictError` (409) si no alcanza; `TransitionOrderUseCase` restituye el stock si el pedido se cancela antes de la entrega (`STOCK_RESERVED_STATUSES`)
- [x] Tests: CRUD de productos, aislamiento por tenant, tabla de decisión de transiciones de pedido, SKU único de variante, `effective_price` (con/sin `price_override`), descuento de stock al crear, stock insuficiente → 409, suma de cantidades de la misma variante repetida, restitución de stock al cancelar, no restitución al entregar — `apps/modules/store/tests/` (28 tests)
- [x] Seed/demo: organización "UrbanStore" con módulo `store` activo, dos productos con variantes, un registro de inventario, un lanzamiento próximo con preventa y un pedido confirmado (`apps/organizations/management/commands/seed_demo.py`)
- [x] Frontend: `frontend/src/features/store/` — `ProductListPage` (lista + filtro por estado + indicador de "Stock bajo") / `ProductFormPage` (CRUD de producto + gestión de variantes inline en modo edición), `OrderListPage` (listar + crear pedido con cliente/sucursal/ítems dinámicos), `OrderDetailPage` (detalle + botones de transición hacia los estados válidos); rutas `/tienda/productos`, `/tienda/pedidos`; enlaces "Productos"/"Pedidos de tienda" en `AppLayout`, visibles solo si el módulo `store` está activo
- [x] Frontend verificado con `tsc -b`, `eslint .`, `vitest run` en verde (39/39 tests totales del frontend, incluidos 6 nuevos del módulo tienda)
- [x] Backend verificado estáticamente sin Postgres real: `python manage.py check` sin errores, `makemigrations --check` sin cambios pendientes, `py_compile` sin errores de sintaxis, 28 tests recolectados sin errores de import (`pytest --collect-only`)
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con las fases anteriores, al retomar Docker)
- [ ] Commit convencional propuesto

## Fase 11 — Módulo Legal (abogados)

- [x] Modelos: `LegalCase`, `CaseEvent`, `Hearing`, `CaseTask` (`apps/modules/legal/models.py`) — construidos desde cero, como Fase 10. `CaseEvent` es la cronología de dominio visible al equipo legal, distinta de `AuditLog` (registro de seguridad inmutable); se crea tanto manualmente como automáticamente en cada transición de estado
- [x] Estados del caso con transiciones: `new → in_review → active ⇄ on_hold → closed → archived`, con reapertura permitida `closed → active` (limpia `closed_at`) y cierre temprano posible desde `new`/`in_review` (`VALID_CASE_TRANSITIONS`, `apps/modules/legal/models.py`)
- [x] API + UI: casos (crear, listar, transicionar, cronología GET/POST), audiencias (CRUD filtrable por caso), tareas (CRUD filtrable por caso, marcar completada) — `apps/modules/legal/{views,urls}.py` bajo `/api/modules/legal/`. Asociación de documentos **no implementada todavía a propósito**: el modelo `documents/` genérico es de la Fase 11B (transversal), que aún no existe; se conecta ahí cuando llegue esa fase, no antes (regla de "una fase a la vez")
- [x] **Permisos estrictos con alcance sobre casos propios (primera vez que se implementa a nivel de queryset, no solo de permiso de módulo):** `legal:read`/`legal:write` para Admin y Profesional, `legal:read_all` solo para Admin. Un profesional sin `legal:read_all` solo ve (`LegalCaseViewSet.get_queryset`) los casos donde es `responsible_lawyer`; Audiencias y Tareas heredan el mismo alcance a través de su caso (`CaseScopedViewSet`). Recepción sin acceso al módulo (mismo criterio de sensibilidad que Laboratorio, `docs/auth-rbac.md`)
- [x] Auditoría: cada creación/transición de caso queda en `AuditLog` además del `CaseEvent` de dominio
- [x] Tests: SKU/número de caso único por organización, tabla de decisión de transiciones (10 casos), creación con evento de apertura automático, cierre fija `closed_at`/reapertura lo limpia, transición inválida → 409, aislamiento por tenant, acceso por rol (Recepción sin acceso), **alcance sobre casos propios** (profesional solo ve los suyos; admin con `legal:read_all` ve todos; audiencias de un caso ajeno no aparecen) — `apps/modules/legal/tests/` (25 tests)
- [x] Seed/demo: organización "Estudio Jurídico XYZ" con módulo `legal` activo, un caso activo con audiencia programada y tarea pendiente, y un segundo caso recién abierto (`apps/organizations/management/commands/seed_demo.py`)
- [x] Frontend: `frontend/src/features/legal/` — `CaseListPage` (listar + crear caso) / `CaseDetailPage` (transición de estado, cronología con formulario de evento manual, audiencias, tareas con "marcar completada"); rutas `/legal/casos`, `/legal/casos/:id`; enlace "Casos" en `AppLayout`, visible solo si el módulo `legal` está activo
- [x] Frontend verificado con `tsc -b`, `eslint .`, `vitest run` en verde (44/44 tests totales del frontend, incluidos 5 nuevos del módulo legal)
- [x] Backend verificado estáticamente sin Postgres real: `python manage.py check` sin errores, `makemigrations --check` sin cambios pendientes, `py_compile` sin errores, 25 tests recolectados sin errores de import
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con las fases anteriores, al retomar Docker)
- [ ] Commit convencional propuesto

## Fase 11B — Documentos, tareas y búsqueda global (transversal)

- [x] `apps/documents/`: modelo `Document` asociable vía `owner_type`/`owner_id` (customer|appointment|case|work_order|patient|order, docs/erd.md) en vez de una FK tipada por cada módulo. Incluye `file` (`FileField`, no estaba en el ERD como columna explícita pero es necesario para que "documento" sea funcional — almacenamiento local en el MVP, configurable por `DJANGO_MEDIA_ROOT`, portabilidad ISO 25010)
- [x] **Control de acceso desde el inicio, no agregado después:** `core/owner_access.py` — un `owner_type` nuevo solo agrega una entrada al mapeo `OWNER_TYPE_PERMISSIONS` (Open/Closed), sin tocar `Document` ni `Task`. Reutiliza el alcance "solo mis casos" de Fase 11 (`legal:read_all`) para `owner_type="case"`, tanto en documentos como en tareas — mismo criterio de sensibilidad, una sola fuente de verdad
- [x] Registro de descargas en auditoría: acción nueva `download` en `DocumentViewSet` audita `AuditAction.DOWNLOAD` con `entity_type="Document"`, además de la auditoría estándar de creación
- [x] `apps/tasks/`: modelo `Task` genérico asociable (título, descripción, responsable, fecha límite, prioridad, estado) — distinto de `CaseTask` (Fase 11, propio del módulo Legal). Mismo patrón `owner_type`/`owner_id` y control de acceso que `Document`. Sin filtro de propietario, `GET /api/tasks/` devuelve la bandeja personal (tareas asignadas al usuario autenticado) — extensión pequeña y útil, no pedida explícitamente pero coherente con "tareas asociables"
- [x] Búsqueda global (`apps/search/`, sin modelo propio): agrega resultados de clientes, citas, motos, casos legales, pedidos y documentos en una sola respuesta, filtrada por módulo activo de la organización y por permiso `:read` del usuario en cada tipo — nunca consulta un recurso para el que no hay permiso ni un módulo inactivo. Los casos legales respetan además el alcance "solo mis casos". Deliberadamente **no** busca en `Patient`/`LabResult` (dato clínico sensible, fuera del alcance pedido explícitamente para la búsqueda global)
- [x] Tests: control de acceso a documentos (recepción sin permiso al módulo legal → 403, tipo de propietario no soportado → 400, listar exige `owner_type`+`owner_id`, descarga auditada, aislamiento por tenant), tareas (creación con alcance, bandeja personal, no reasignación de propietario desde `update`), búsqueda (query corta vacía, respeta permisos, respeta módulo activo/inactivo, aislamiento por tenant) — `apps/documents/tests/`, `apps/tasks/tests/`, `apps/search/tests/` (19 tests)
- [x] Frontend: `frontend/src/features/documents/DocumentsPanel.tsx` y `frontend/src/features/tasks/TasksPanel.tsx` (componentes reutilizables, no páginas propias — se insertan donde haga falta), integrados en `CustomerHistoryPage` (documentos + tareas) y `CaseDetailPage` (documentos); `frontend/src/features/search/SearchPage.tsx` con ruta `/buscar` y enlace en `AppLayout` (siempre visible, no depende de módulo). Descarga implementada como blob autenticado (no enlace directo, porque requiere el header `Authorization`)
- [x] Frontend verificado con `tsc -b`, `eslint .`, `vitest run` en verde (52/52 tests totales del frontend, incluidos 8 nuevos de esta fase)
- [x] Backend verificado estáticamente sin Postgres real: `python manage.py check` sin errores, `makemigrations --check` sin cambios pendientes, 19 tests recolectados sin errores de import
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con las fases anteriores, al retomar Docker)
- [ ] Commit convencional propuesto

## Fase 12 — Reportes y dashboards

- [x] Dashboard administrativo (`GET /api/reports/dashboard/`): citas de hoy (total + desglose por estado), próximas 7 días; clientes nuevos del mes e ingresos del mes solo con `reports:financial`
- [x] Gráficos: citas por día/semana/mes, ingresos, servicios más solicitados, clientes nuevos — un único endpoint parametrizado `GET /api/reports/charts/?metric=&group_by=&date_from=&date_to=` en vez de un endpoint por métrica, para no multiplicar rutas casi idénticas
- [x] Reportes generales: citas, clientes, ingresos, servicios (vía top_services en charts), cancelaciones, no asistencias, productividad — consolidados en un único `GET /api/reports/summary/` (un payload, no siete endpoints sueltos)
- [x] Reportes por módulo activo (taller, laboratorio, tienda, legal): `GET /api/reports/modules/<module_code>/`, 404 si el módulo no está activo para la organización
- [x] Agregaciones pesadas en servicios, no en vistas: todo el cálculo (`Count`/`Sum`/`Trunc*` del ORM) vive en `apps/reports/services.py`; las vistas (`views.py`) solo parsean parámetros y llaman al servicio — ninguna agregación en Python puro sobre querysets ya traídos a memoria
- [x] **Filtrado por rol y organización:** dos permisos nuevos, `reports:read` (Admin/Recepción/Profesional) y `reports:financial` (solo Admin — ingresos, clientes nuevos, productividad cruzada entre empleados). El alcance "solo mis cifras" para un profesional se resuelve igual que en Fases 11/11B: si el usuario actor tiene `employee_profile`, las consultas de citas/productividad se acotan a ese empleado, sin necesidad de una tabla de roles nueva
- [x] Tests: cifras financieras visibles solo con el permiso, alcance por empleado en dashboard/reporte general/gráficos, tasa de cancelación calculada correctamente, `group_by`/`metric` inválidos → 400, reporte de módulo inactivo → 404, módulo sin reporte soportado → 400 — `apps/reports/tests/` (15 tests)
- [x] Frontend: `frontend/src/features/reports/` — `DashboardPage` (tarjetas + gráficos de barra en HTML/CSS plano, sin librería nueva) y `ReportsPage` (reporte general con rango de fechas + reportes por módulo activo, renderizados como lista legible en vez de JSON crudo). Gráficos diseñados siguiendo la skill `dataviz`: una sola serie por gráfico → un solo color de acento (la magnitud la codifica la longitud, no el color), estados del día reutilizan las clases `badge-status-*` ya existentes en vez de una paleta nueva, etiquetas directas en cada barra (lista corta, sin necesidad de tooltip). Ruta `/dashboard` (nuevo enlace principal en `AppLayout`, primero en el nav) y `/reportes`
- [x] Frontend verificado con `tsc -b`, `eslint .`, `vitest run` en verde (57/57 tests totales del frontend, incluidos 5 nuevos de esta fase)
- [x] Backend verificado estáticamente sin Postgres real: `python manage.py check` sin errores, `makemigrations --check` sin cambios pendientes (esta app no tiene modelos propios), 15 tests recolectados sin errores de import
- [ ] Suite de tests backend corrida y en verde contra PostgreSQL real (**pendiente**: junto con las fases anteriores, al retomar Docker)
- [ ] Commit convencional propuesto

## Fase 12B — API pública de integración (para terceros)

- [ ] Namespace `/api/public/v1/` en `apps/integrations/`
- [ ] Modelo `ApiKey` (secreto hasheado, prefijo, rotación)
- [ ] Modelo `OAuthClient` (client-credentials)
- [ ] Scopes granulares por credencial, tenant fijado desde la credencial
- [ ] Endpoints públicos sobre recursos clave (reutilizando casos de uso existentes)
- [ ] Paginación, filtros, ordenamiento, idempotencia (`Idempotency-Key`)
- [ ] Rate limiting y cuotas por credencial (`X-RateLimit-*`, `429` + `Retry-After`)
- [ ] `WebhookEndpoint` + `WebhookDelivery`, firma HMAC, reintentos con backoff (Celery)
- [ ] Documentación OpenAPI 3 (`drf-spectacular`) publicada en Swagger UI/Redoc
- [ ] Entorno sandbox con datos demo
- [ ] Formato de error uniforme + logging RFC 5424 con `key_id`/`client_id`
- [ ] Tests: aislamiento entre credenciales de distintas organizaciones, scope insuficiente → 403, rate limit → 429, idempotencia evita duplicados, webhooks firmados/reintentados/registrados
- [ ] Seed/demo con credencial de integración de ejemplo
- [ ] Ejemplos `curl` documentados
- [ ] Commit convencional propuesto

## Fase 13 — Seguridad (auditoría y endurecimiento)

> Adelanto puntual (2026-09-08, fuera de esta fase formal): una auditoría de
> configuración encontró y corrigió dos hallazgos que técnicamente caen aquí
> — `AuditLog` no heredaba el aislamiento automático por tenant (ver
> `docs/roadmap.md`, entrada 2026-09-08) y `SECRET_KEY`/`DB_PASSWORD` no
> fallaban rápido en producción si faltaban. No se marcan los ítems de abajo
> como hechos: fue una corrección puntual, no la batería de pruebas de
> aislamiento ni la revisión SoA completa que pide esta fase.

- [ ] Batería de tests de aislamiento entre tenants por cada endpoint/módulo
- [ ] Revisión de permisos por rol en todos los endpoints
- [ ] Control de acceso y descargas auditadas en documentos
- [ ] Expiración, rotación y revocación de refresh tokens/sesiones
- [ ] Rate limiting en auth y endpoints sensibles; validación de entrada; CSRF/XSS/SQLi verificados
- [ ] Verificación de que login, logout, CRUD sensible, descargas, cambios de permisos, citas, pagos, resultados, casos quedan auditados y no son borrables
- [ ] Revisión de dependencias (SCA) + análisis estático (SAST)
- [ ] Revisión del SoA técnico ISO 27001 (`docs/security-iso27001.md`) con evidencia de cada control aplicable
- [ ] Pruebas de seguridad ISTQB (caja negra/blanca) sobre auth, permisos, documentos; cobertura OWASP Top 10; pruebas negativas y de abuso
- [ ] `docs/security-review.md` con hallazgos, correcciones, checklist OWASP, estado ISO 27001
- [ ] Test de regresión por cada hallazgo corregido
- [ ] Commit convencional propuesto

## Fase 14 — Producción y despliegue

- [ ] Docker de producción (backend + frontend) + Nginx reverse proxy + HTTPS
- [ ] Gestión de variables de entorno con secretos fuera del repo
- [ ] Backups automáticos de BD y documentos, política de retención, restauración probada
- [ ] Logging RFC 5424 completo en producción (sin datos sensibles) + hook a Sentry/monitoreo
- [ ] CI/CD (lint + tests) + `docs/deployment.md`
- [ ] Arquitectura preparada para suscripciones futuras (planes con límites de sucursales/usuarios/módulos), sin implementar cobro real
- [ ] Verificación: sistema levanta en modo producción con docker-compose
- [ ] Verificación: backups se generan y restauran correctamente
- [ ] Verificación: suite de tests completa sigue en verde
- [ ] Commit final propuesto

## Criterio de éxito final (validación end-to-end)

- [ ] Crear empresa "Motors Ecuador", activar módulo Taller, 3 empleados, 20 servicios, 2 sucursales, 500 clientes, 700 motos, horarios y citas agendadas
- [ ] Crear empresa "Laboratorio ABC" con solo Clientes, Citas y Laboratorio activos
- [ ] Confirmar que ambas empresas operan de forma totalmente independiente, sin datos visibles entre sí
