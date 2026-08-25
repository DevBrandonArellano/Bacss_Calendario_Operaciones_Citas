"""Catálogo de permisos base y su asignación a los roles de sistema.

Fuente de verdad ejecutable de la matriz de docs/auth-rbac.md (subconjunto
correspondiente a lo ya implementado en la Fase 2). Se amplía en cada fase
que agregue recursos nuevos.
"""

from apps.users.models import SystemRoleCode

PERMISSIONS: list[tuple[str, str]] = [
    ("organizations:read", "Ver la configuración de la organización propia"),
    ("organizations:write", "Editar la configuración de la organización propia"),
    ("branches:read", "Ver sucursales"),
    ("branches:write", "Crear/editar/eliminar sucursales"),
    ("users:read", "Ver usuarios de la organización"),
    ("users:write", "Crear/editar usuarios y asignar roles"),
    ("audit:read", "Ver el registro de auditoría"),
    ("customers:read", "Ver clientes"),
    ("customers:write", "Crear/editar/eliminar clientes"),
    ("services:read", "Ver servicios"),
    ("services:write", "Crear/editar/eliminar servicios"),
    ("employees:read", "Ver profesionales/empleados"),
    ("employees:write", "Crear/editar/eliminar profesionales y asignar sus servicios"),
    ("scheduling:read", "Ver horarios, descansos y bloqueos de disponibilidad"),
    ("scheduling:write", "Crear/editar/eliminar horarios y bloqueos de disponibilidad"),
    ("appointments:read", "Ver citas"),
    ("appointments:write", "Crear, confirmar, cancelar y reprogramar citas"),
    ("notifications:read", "Ver el propio centro de notificaciones internas"),
    ("payments:read", "Ver pagos"),
    ("payments:write", "Registrar y reembolsar pagos"),
    ("moto:read", "Ver motos, historial vehicular y órdenes de trabajo (módulo Taller)"),
    ("moto:write", "Crear/editar motos, registrar historial y gestionar órdenes de trabajo (módulo Taller)"),
    ("laboratory:read", "Ver pacientes, pedidos, pruebas y muestras (módulo Laboratorio)"),
    ("laboratory:write", "Crear pacientes/pedidos y avanzar el proceso de pruebas (módulo Laboratorio)"),
    ("lab_results:read", "Ver resultados clínicos (dato sensible, módulo Laboratorio)"),
    ("lab_results:write", "Validar resultados clínicos — acción auditada (módulo Laboratorio)"),
    ("store:read", "Ver productos, variantes, inventario, lanzamientos y pedidos (módulo Tienda)"),
    (
        "store:write",
        "Crear/editar productos y variantes, registrar inventario y gestionar pedidos (módulo Tienda)",
    ),
    ("legal:read", "Ver casos, cronología, audiencias y tareas (dato sensible, módulo Legal)"),
    ("legal:write", "Crear/editar casos, audiencias y tareas (módulo Legal)"),
    ("legal:read_all", "Ver todos los casos de la organización, no solo los propios (módulo Legal)"),
    ("reports:read", "Ver el dashboard y los reportes operativos"),
    (
        "reports:financial",
        "Ver cifras financieras y de productividad cruzada en reportes (ingresos, clientes nuevos)",
    ),
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    SystemRoleCode.ORG_ADMIN: [
        "organizations:read",
        "organizations:write",
        "branches:read",
        "branches:write",
        "users:read",
        "users:write",
        "audit:read",
        "customers:read",
        "customers:write",
        "services:read",
        "services:write",
        "employees:read",
        "employees:write",
        "scheduling:read",
        "scheduling:write",
        "appointments:read",
        "appointments:write",
        "notifications:read",
        "payments:read",
        "payments:write",
        "moto:read",
        "moto:write",
        "laboratory:read",
        "laboratory:write",
        "lab_results:read",
        "store:read",
        "store:write",
        "legal:read",
        "legal:write",
        "legal:read_all",
        "reports:read",
        "reports:financial",
    ],
    SystemRoleCode.RECEPTION: [
        "branches:read",
        "users:read",
        "customers:read",
        "customers:write",
        "services:read",
        "employees:read",
        "scheduling:read",
        "scheduling:write",
        "appointments:read",
        "appointments:write",
        "notifications:read",
        "payments:read",
        "payments:write",
        "moto:read",
        "moto:write",
        "store:read",
        "store:write",
        "reports:read",
        # Sin `reports:financial`: docs/auth-rbac.md marca "R (limitado,
        # operativo)" para Recepción — ve operación (citas, cancelaciones),
        # no cifras financieras ni productividad cruzada.
        # Sin acceso al módulo laboratorio: docs/auth-rbac.md marca "–" para
        # Recepción en LabResult; se extiende esa restricción a todo el
        # módulo por la sensibilidad de los datos clínicos.
    ],
    SystemRoleCode.PROFESSIONAL: [
        "branches:read",
        "customers:read",
        "services:read",
        "employees:read",
        "scheduling:read",
        "appointments:read",
        "appointments:write",
        "notifications:read",
        "payments:read",
        "moto:read",
        "moto:write",
        "laboratory:read",
        "laboratory:write",
        "lab_results:read",
        "lab_results:write",
        "store:read",
        "store:write",
        "legal:read",
        "legal:write",
        # Sin `legal:read_all`: alcance sobre lo propio, solo ve los casos
        # donde es `responsible_lawyer` (docs/auth-rbac.md).
        "reports:read",
        # Sin `reports:financial`: docs/auth-rbac.md marca "R (propios)" —
        # ve sus propias cifras de citas/productividad, no ingresos ni la
        # productividad de otros empleados.
    ],
    SystemRoleCode.CUSTOMER: [],
}
