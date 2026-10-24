# Autenticación y RBAC

## Autenticación

- Modelo de usuario personalizado (`users.User`) desde el inicio (Fase 2), con `email` como identificador de login, `password_hash` (hashing por defecto de Django), y flag `is_platform_superadmin` separado del sistema de roles por organización.
- JWT con refresh tokens (`djangorestframework-simplejwt`): access token de vida corta, refresh token de vida más larga con rotación y lista de revocación (blacklist) para logout efectivo y revocación ante robo de token.
- Recuperación de contraseña por email con token de un solo uso y expiración corta.
- Rate limiting específico sobre `login/`, `password-reset/`, `token/refresh/` (más estricto que el resto de la API) para mitigar fuerza bruta.
- MFA: no se implementa en el MVP, pero el modelo de usuario y el flujo de login se diseñan para poder insertar un paso adicional sin romper el contrato (`docs/security-iso27001.md`, control A.5/A.8).

## Roles (RBAC)

| Rol | Alcance | Descripción |
|---|---|---|
| **Superadministrador** | Plataforma (cross-tenant) | Gestiona organizaciones, activación de módulos a nivel comercial, soporte técnico. Acceso "sin filtro" de tenant, marcado explícitamente en código (ver ADR-001). No debería operar datos de negocio de una organización salvo soporte auditado. |
| **Administrador de empresa** | Una organización | Gestiona sucursales, usuarios/roles de su empresa, servicios, empleados, configuración de módulos activados (dentro de lo permitido por su plan), reportes completos de su organización. |
| **Recepción** | Una organización (y opcionalmente sucursal) | Gestiona clientes, agenda, citas, pagos, documentos operativos. No gestiona usuarios ni configuración de la empresa. |
| **Profesional/empleado** | Una organización, alcance sobre lo propio | Ve y gestiona su propia agenda y las citas asignadas a él; ve clientes que atiende; en módulos sensibles (laboratorio, legal) solo lo asignado a su caso/orden. |
| **Cliente** | Alcance de sí mismo | Acceso limitado (portal de reserva online / futura app): ver y gestionar sus propias citas, ver su propio historial, documentos que le corresponden. Nunca ve datos de otros clientes. |

Los roles son configurables a nivel de permisos granulares (`Permission`, formato `recurso:accion`), pero los 5 roles de arriba son el set base que trae el sistema (`is_system_role=True`); una organización puede crear roles adicionales combinando permisos existentes si el plan lo permite (documentado como extensión, no bloqueante para el MVP).

## Matriz de permisos (resumen, por recurso × acción)

| Recurso | Superadmin | Admin empresa | Recepción | Profesional | Cliente |
|---|---|---|---|---|---|
| Organización (config) | CRUD (todas) | RU (la propia) | – | – | – |
| Usuarios/roles | CRUD (todas) | CRUD (su empresa) | R (su empresa) | – | – |
| Sucursales | CRUD (todas) | CRUD (su empresa) | R | R | – |
| Clientes | R (soporte) | CRUD | CRUD | R/U (los que atiende) | R/U (su propio perfil) |
| Servicios/empleados | R (soporte) | CRUD | R | R (propio) | R (catálogo público) |
| Horarios/disponibilidad | R (soporte) | CRUD | RU | RU (propio) | R (para reservar) |
| Citas | R (soporte) | CRUD | CRUD | RU (asignadas a él) | CRU (las propias) |
| Pagos | R (soporte) | CRUD | CRUD | R (asociados a sus citas) | R (los propios) |
| Documentos | R (soporte, auditado) | CRUD | CRUD (según owner) | RU (asociados a lo suyo) | R (los que le pertenecen) |
| Módulo laboratorio (`LabResult`) | R (soporte, auditado) | R | – (salvo permiso explícito) | RU (si es el profesional responsable) | R (los propios, si aplica) |
| Módulo legal (`LegalCase`) | R (soporte, auditado) | R | – (salvo permiso explícito) | RU (casos asignados) | R (los propios, si aplica) |
| Auditoría (`AuditLog`) | R | R (su empresa) | – | – | – |
| Reportes | R (agregado plataforma) | R (su empresa) | R (limitado, operativo) | R (propios) | – |

`C`=crear, `R`=leer, `U`=actualizar, `D`=eliminar (soft-delete donde aplique); "–" = sin acceso. La matriz completa, con cada permiso `recurso:accion` uno a uno, se mantiene versionada en código (fixtures/migración de datos de `Permission`/`Role`) para que sea la fuente de verdad ejecutable, no solo documental.

## Aplicación técnica

- Permission classes de DRF por vista/acción, compuestas (`IsAuthenticated & HasPermission('customers:write') & ModuleActiveRequired('moto')` cuando aplica).
- Las reglas de "alcance sobre lo propio" (profesional ve solo sus citas, cliente ve solo lo suyo) se aplican como filtro adicional en el queryset del manager tenant-aware, no como un chequeo posterior a nivel de objeto individual únicamente — así una lista paginada nunca filtra datos ajenos por accidente.
- Cambios de rol/permiso son acción sensible → quedan en `AuditLog`.

## Permisos efectivos en la interfaz (2026-10-24)

`GET /api/users/me/` devuelve el perfil del usuario en sesión con la lista de códigos de permiso que sus roles le conceden. La interfaz lo usa **solo para mostrar u ocultar acciones** (p. ej. «Nueva cita», acciones rápidas del Dashboard). No es un control de seguridad: cada endpoint sigue validando el permiso en el servidor y, si la lista no carga, la UI degrada ocultando acciones (nunca concediendo). Solo expone los permisos del propio usuario.
