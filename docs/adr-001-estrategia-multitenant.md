# ADR-001: Estrategia multitenant

**Estado:** Aceptado
**Fecha:** 2026-08-14
**Contexto de decisión:** Fase 1 — Arquitectura

## Contexto

La plataforma debe garantizar que ninguna consulta pueda devolver datos de una organización distinta a la del usuario autenticado (regla #1, no negociable, definida en `CLAUDE.md`). Existen dos estrategias clásicas de multitenancy sobre PostgreSQL:

1. **Schema compartido con discriminador `organization_id`**: una sola base de datos, un solo esquema, todas las tablas de negocio llevan una FK `organization_id`; el aislamiento se aplica a nivel de aplicación (managers/querysets) y, opcionalmente, con Row Level Security (RLS) de PostgreSQL.
2. **Schema-per-tenant** (p. ej. con `django-tenants`): cada organización tiene su propio esquema PostgreSQL dentro de la misma base de datos física; el aislamiento lo da PostgreSQL mismo al cambiar de `search_path` por request.

## Comparación

| Criterio | Schema compartido + `organization_id` | Schema-per-tenant |
|---|---|---|
| Complejidad inicial | Baja: un solo set de migraciones, un solo pool de conexiones | Alta: routing de esquema por request/dominio, migraciones que corren N veces (una por tenant) |
| Costo de infraestructura | Bajo: una base de datos, escala vertical simple | Medio-alto: más conexiones, migraciones más lentas al crecer el número de tenants |
| Aislamiento de datos | Depende de disciplina de aplicación (managers, middleware); reforzable con RLS | Fuerte por diseño: un tenant físicamente no puede leer el esquema de otro sin cambiar `search_path` |
| Facilidad de onboarding de nuevo tenant | Trivial: insertar una fila `Organization` | Requiere crear y migrar un esquema nuevo |
| Reportes/analítica cross-tenant (para el operador de la plataforma) | Simple: una sola tabla, un `GROUP BY organization_id` | Complejo: requiere consultar N esquemas o replicar a un data warehouse |
| Riesgo de "fuga" de datos por bug de aplicación | Mayor si no hay disciplina + tests exhaustivos | Menor, porque el aislamiento no depende solo del código de aplicación |
| Backup/restore selectivo por tenant | Difícil (todo o nada, o export filtrado) | Más simple (se puede exportar/restaurar un esquema) |
| Cumplimiento regulatorio fuerte por tenant (ej. datos clínicos de un laboratorio grande) | Requiere controles adicionales (RLS, cifrado por fila) | Facilita justificar aislamiento físico ante auditorías |

## Decisión

Para el MVP se adopta **schema y base de datos compartidos, con discriminador `organization_id`** en todo modelo de negocio, vía `TenantAwareModel` (ver `CLAUDE.md`), reforzado por:

- Manager/queryset por defecto que **siempre** filtra por la organización del usuario autenticado (resuelta por middleware, nunca por el payload del cliente).
- Un manager "sin filtro" separado y explícitamente marcado, accesible solo desde código de superadministrador de plataforma.
- Índice compuesto `(organization_id, ...)` en las tablas de mayor volumen (citas, clientes) para que el filtro por tenant no degrade performance.
- Batería de tests de aislamiento (Fase 2 en adelante y auditoría completa en Fase 13) que verifican sistemáticamente, endpoint por endpoint, que un usuario de la Empresa A no puede leer ni escribir datos de la Empresa B.
- Evaluar activar **Row Level Security (RLS)** de PostgreSQL como defensa en profundidad una vez el modelo de datos esté estable (no bloqueante para el MVP, sí recomendado antes de vender el SaaS a clientes con datos sensibles como laboratorios o despachos legales).

**Motivo:** es la opción más simple y barata para lanzar rápido con pocos tenants, no exige infraestructura de routing de esquemas, y no cierra la puerta a evolucionar. Dado que la regla de aislamiento es no negociable, el riesgo de "disciplina de aplicación" se mitiga con arquitectura (managers por defecto + middleware) y con una suite de tests de aislamiento obligatoria en cada fase, no solo al final.

## Ruta de migración futura

Si el volumen, el número de tenants grandes, o requisitos regulatorios de un módulo sensible (laboratorio, legal) lo exigen, se migra a **schema-per-tenant** con `django-tenants`:

1. El discriminador `organization_id` ya presente en todos los modelos facilita el script de migración de datos (partición por `organization_id` → un esquema nuevo por organización).
2. Se puede migrar de forma incremental: empezar aislando solo a los tenants grandes o con requisitos regulatorios estrictos, dejando al resto en el esquema compartido (modelo híbrido), si `django-tenants` lo permite en la versión vigente al momento de migrar.
3. El middleware de resolución de tenant ya existente se extiende para resolver también el esquema físico, sin cambiar el contrato con el resto de la aplicación (las vistas/servicios no deberían enterarse del cambio).

## Consecuencias

- **Positivas:** velocidad de desarrollo, costo de infraestructura bajo, operaciones simples (un solo backup, una sola migración).
- **Negativas / riesgos aceptados:** el aislamiento depende de disciplina de código y de tests; se acepta mitigándolo con arquitectura (managers por defecto) y una política de tests de aislamiento obligatoria desde la Fase 2.
- **Trigger de revisión:** reevaluar esta decisión si (a) un tenant individual supera un volumen que degrade a los demás, (b) un cliente de los módulos laboratorio/legal exige aislamiento físico por contrato o regulación, o (c) el número de tenants activos hace inviable el `GROUP BY` en reportes de plataforma.
