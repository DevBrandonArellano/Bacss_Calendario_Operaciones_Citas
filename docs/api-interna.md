# Contrato de API interna (`/api/...`)

Consumida exclusivamente por el frontend propio (React SPA) y, a futuro, apps móviles first-party. Autenticación por JWT de sesión de usuario (`djangorestframework-simplejwt`). **No** debe ser usada por terceros — para eso existe `/api/public/v1/...` (ver `docs/public-api.md`).

## Convenciones generales

- Prefijo: `/api/`. Versionado por ahora implícito (v1 única); si se rompe compatibilidad de forma relevante, se evalúa `/api/v2/` (menos estricto que la API pública, ya que el único cliente es el frontend propio desplegado junto al backend).
- Formato: JSON. Paginación estándar DRF (`page`, `page_size`, respuesta `{count, next, previous, results}`).
- Filtros y ordenamiento: `?field=value` para filtros exactos, `?ordering=field,-field2` para orden.
- Errores: formato uniforme definido en `docs/error-handling.md` (`{code, message, details, request_id}`).
- Todas las rutas de negocio son **tenant-scoped implícitamente**: el usuario autenticado determina la organización; nunca se acepta `organization_id` en query params ni body para filtrar resultados.

## Rutas por recurso (core)

| Recurso | Rutas | Notas |
|---|---|---|
| Auth | `POST /api/auth/register/`, `POST /api/auth/login/`, `POST /api/auth/logout/`, `POST /api/auth/token/refresh/`, `POST /api/auth/password-reset/`, `POST /api/auth/password-reset/confirm/` | Rate limiting reforzado (ver `docs/security-strategy.md`). |
| Organización | `GET/PATCH /api/organizations/me/`, `GET/PATCH /api/organizations/me/modules/` | Solo Admin de empresa o Superadmin de plataforma. |
| Sucursales | `GET/POST /api/branches/`, `GET/PATCH/DELETE /api/branches/{id}/` | |
| Usuarios/roles | `GET/POST /api/users/`, `GET/PATCH/DELETE /api/users/{id}/`, `GET /api/roles/`, `POST /api/users/{id}/roles/` | |
| Clientes | `GET/POST /api/customers/`, `GET/PATCH/DELETE /api/customers/{id}/`, `GET /api/customers/search/?q=`, `GET /api/customers/{id}/history/` | Búsqueda por nombre, documento, teléfono, email. |
| Servicios | `GET/POST /api/services/`, `GET/PATCH/DELETE /api/services/{id}/` | |
| Empleados | `GET/POST /api/employees/`, `GET/PATCH/DELETE /api/employees/{id}/`, `POST /api/employees/{id}/services/` | |
| Horarios/disponibilidad | `GET/POST /api/schedules/`, `GET/POST /api/availability-blocks/`, `GET /api/availability/?service_id=&employee_id=&branch_id=&date=` | El último endpoint expone el motor de disponibilidad (`docs/availability-engine.md`), solo lectura. |
| Citas | `GET/POST /api/appointments/`, `GET/PATCH/DELETE /api/appointments/{id}/`, `POST /api/appointments/{id}/reschedule/`, `POST /api/appointments/{id}/cancel/`, `POST /api/appointments/{id}/confirm/` | Creación pasa por el motor de reservas (`docs/booking-engine.md`). |
| Pagos | `GET/POST /api/payments/`, `GET /api/payments/{id}/`, `POST /api/payments/{id}/refund/` | |
| Notificaciones | `GET /api/notifications/`, `POST /api/notifications/{id}/read/` | Centro de notificaciones internas. |
| Documentos | `GET/POST /api/documents/`, `GET /api/documents/{id}/download/`, `DELETE /api/documents/{id}/` | Descargas auditadas. |
| Tareas | `GET/POST /api/tasks/`, `GET/PATCH/DELETE /api/tasks/{id}/` | |
| Búsqueda global | `GET /api/search/?q=` | Filtrado por módulos activos y permisos del usuario. |
| Reportes | `GET /api/reports/dashboard/`, `GET /api/reports/appointments/`, `GET /api/reports/revenue/`, ... | Uno por tipo de reporte, ver `docs/roadmap.md` para el detalle por fase. |
| Auditoría | `GET /api/audit-logs/` | Solo lectura, solo roles con permiso `audit:read`. |

## Rutas por módulo (solo si el módulo está activo para la organización)

| Módulo | Prefijo | Recursos principales |
|---|---|---|
| Taller de motos | `/api/modules/moto/` | `motorcycles/`, `motorcycles/{id}/history/`, `work-orders/`, `work-orders/{id}/transition/`, `work-orders/{id}/items/` |
| Laboratorio | `/api/modules/laboratory/` | `patients/`, `lab-orders/`, `lab-tests/`, `samples/`, `lab-results/`, `lab-tests/{id}/validate/` |
| Tienda | `/api/modules/store/` | `products/`, `product-variants/`, `inventory/`, `launches/`, `orders/` |
| Legal | `/api/modules/legal/` | `cases/`, `cases/{id}/events/`, `cases/{id}/hearings/`, `cases/{id}/tasks/` |

Si un módulo no está activo para la organización del usuario, las rutas bajo su prefijo devuelven `404` (no `403`, para no filtrar la existencia del módulo a quien no lo tiene).

## Convenciones de escritura

- `POST`/`PATCH` validan con serializers DRF; toda regla de negocio (disponibilidad, transición de estado válida, cálculo de totales) vive en la capa de servicios/casos de uso, nunca en el serializer.
- Las transiciones de estado (cita, orden, caso, muestra, pedido) se exponen como acciones explícitas (`/confirm/`, `/cancel/`, `/reschedule/`) en vez de permitir `PATCH` arbitrario del campo `status`, para poder validar la transición y auditar el motivo.
