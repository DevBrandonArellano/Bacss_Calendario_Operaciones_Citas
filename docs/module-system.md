# Diseño del sistema de módulos

## Objetivo

Una misma base de código sirve a empresas de rubros distintos (taller, laboratorio, tienda, legal). El core (organizaciones, sucursales, usuarios, clientes, servicios, agenda, citas, pagos, documentos, notificaciones, auditoría, reportes básicos) es común a todas. Los módulos especializados (`moto`, `laboratory`, `store`, `legal`) solo se cargan/exponen si la empresa los tiene activados, sin que el resto de la plataforma tenga que conocer los detalles de cada módulo.

## Modelo de activación

- Tabla `ModuleActivation` (`organization_id`, `module_code`, `is_active`, `config` JSONB, `activated_at`, `deactivated_at`). Único `(organization_id, module_code)`.
- `module_code` es un identificador estable (`moto`, `laboratory`, `store`, `legal`); nuevos módulos futuros solo agregan una fila de catálogo, no requieren cambiar el modelo.
- `config` permite parametrizar el módulo por empresa sin nuevas migraciones (p. ej. plantilla de numeración de expediente legal, unidades de medida del laboratorio).

## Efecto sobre el backend

- Cada módulo vive en `apps/modules/{codigo}/` como una app Django independiente, con sus propios modelos, serializers, vistas, permisos y tests. No importa código de otros módulos entre sí (aislamiento).
- **Registro de módulos:** un registro central (`core/modules/registry.py`) mapea `module_code → { app_label, url_prefix, required_scopes_publicos }`. Los módulos se registran ahí, no se hardcodea la lista en el core.
- **Enrutamiento condicional:** un middleware/permission class de DRF (`ModuleActiveRequired`) verifica, antes de despachar la vista, que `ModuleActivation` para `(organization_actual, module_code)` exista y esté activa. Si no, la vista responde `404` (no `403`, para no revelar la existencia del módulo a organizaciones que no lo tienen).
- **Migraciones:** las tablas de un módulo existen para todas las organizaciones (misma base de datos compartida, ADR-001), pero permanecen vacías/no accesibles para quienes no activaron el módulo. No se crean/destruyen tablas dinámicamente por organización.
- **Casos de uso compartidos:** cuando un módulo necesita interactuar con el core (p. ej. `WorkOrder` originado desde un `Appointment`), lo hace a través de interfaces del core (servicios, señales/eventos de dominio — ver Fase 6), nunca accediendo directo a tablas internas de otro módulo.

## Efecto sobre el frontend

- El frontend consulta `GET /api/organizations/me/` al iniciar sesión (`AuthContext`, no un sub-endpoint `/modules/` separado como se planeó originalmente aquí) y recibe la lista de módulos activos (`activeModules`/`hasModule()`).
- El router y el menú de navegación (`AppLayout`) se arman dinámicamente a partir de esa lista: los enlaces de un módulo inactivo no aparecen, y sus rutas están protegidas por `routes/ModuleRoute.tsx` (redirige a `/citas` si el módulo no está activo, defensa adicional a los 404 del backend). **Pendiente:** el code-splitting por módulo con `React.lazy` sigue sin implementarse — hoy todos los módulos se descargan en el bundle inicial aunque no estén activos; es una optimización de tamaño de bundle, no bloqueante, a retomar si el número de módulos sigue creciendo (docs/roadmap.md).
- Los formularios/vistas de detalle del core (p. ej. historial de cliente) se extienden vía secciones condicionales que solo aparecen si el módulo relevante está activo (p. ej. la ficha de cliente muestra "Motos" solo si `moto` está activo). Los recursos verdaderamente transversales (`Document`, `Task`, Fase 11B) no dependen de ningún módulo — su control de acceso lo resuelve `core/owner_access.py` por tipo de propietario, no por módulo activo.

## Efecto sobre la API pública

- Los recursos de un módulo bajo `/api/public/v1/modules/{modulo}/...` responden `404` si la organización dueña de la credencial no tiene el módulo activo, igual que en la API interna.
- Los scopes específicos de módulo (`moto:read`, etc.) solo tienen efecto si el módulo está activo; una credencial con ese scope pero módulo inactivo también recibe `404`.

## Activación/desactivación

- Activar un módulo es instantáneo (crear/activar la fila `ModuleActivation`); no requiere migración de datos.
- Desactivar un módulo **no borra datos** (soft: `is_active=False`), de modo que reactivarlo restaura el acceso sin pérdida. La eliminación real de datos de un módulo sigue la política general de retención/borrado (ver `docs/security-iso27001.md`).

## Extensibilidad futura

Agregar un módulo nuevo (quinto rubro) implica: nueva app en `apps/modules/`, entrada en el registro de módulos, migraciones propias, y opcionalmente nuevos scopes públicos — sin tocar el core ni los módulos existentes (Open/Closed Principle a nivel de plataforma).
