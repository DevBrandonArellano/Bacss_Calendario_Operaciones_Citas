# Operaciones y Citas

Plataforma **multiempresa (multitenant) y modular** para gestionar citas, clientes, servicios, disponibilidad, empleados, pagos, documentos, notificaciones y operaciones específicas por tipo de negocio.

Una misma base de código se configura para distintos rubros —taller de motos, laboratorio clínico, tienda/lanzamientos, despacho de abogados— activando **módulos especializados** por empresa. No son cuatro aplicaciones: es una plataforma base reutilizable, pensada para convertirse en un SaaS comercial.

Modelo conceptual: **Empresa → Sucursal → Usuarios → Clientes → Servicios → Agenda → Citas → Operaciones**.

## Estado del proyecto

| Fase | Alcance | Estado |
|---|---|---|
| 1 | Arquitectura, ADRs, estándares transversales | ✅ Cerrada |
| 2 | Core multitenant, auth JWT, RBAC, auditoría | ✅ Código + tests |
| 3 | Clientes | ✅ Código + tests |
| 4 | Servicios y profesionales | ✅ Código + tests |
| 5 | Agenda, motor de disponibilidad, motor de reservas | ✅ Código + tests |
| 6 | Notificaciones y recordatorios (email real, WhatsApp/SMS stub) | ✅ Código + tests |
| 7 | Pagos (registro, pagos parciales, reembolsos) | ✅ Código + tests |
| 8 | Módulo Taller de motos | ✅ Código + tests |
| 9 | Módulo Laboratorio clínico | ✅ Código + tests |
| 10 | Módulo Tienda / lanzamientos | ✅ Código + tests |
| 11 | Módulo Legal / abogados | ✅ Código + tests |
| 11B | Documentos, tareas y búsqueda global (transversal) | ✅ Código + tests |
| 12 | Reportes y dashboards | ✅ Código + tests |
| 12B | API pública de integración (`/api/public/v1/`) | 🔜 Siguiente |
| 13 | Endurecimiento de seguridad | ⏳ Pendiente |
| 14 | Producción, observabilidad, suscripciones | ⏳ Pendiente |

**Pendiente conocido:** la suite completa de `pytest` aún no se ha corrido contra PostgreSQL real (incluye el test de concurrencia anti doble-reserva, que requiere el `ExclusionConstraint` de Postgres). El backend está verificado estáticamente (`manage.py check`, `makemigrations --check`, `pytest --collect-only`) y el frontend en verde (`vitest`, `tsc -b`, `eslint`, `vite build`). Esto gana prioridad tras la migración a Django 5.2, que solo está validada estáticamente. Ver detalle en [`docs/roadmap.md`](docs/roadmap.md).

**Estado de dependencias:** `pip-audit` y `npm audit` sin hallazgos (revisión del 2026-08-17). La bitácora de vulnerabilidades cerradas está en [`docs/security-iso27001.md`](docs/security-iso27001.md).

## Stack

- **Backend:** Python 3.12 · Django 5 · Django REST Framework · Celery
- **Base de datos:** PostgreSQL 16 (JSONB para datos flexibles de módulos, `btree_gist` para el constraint anti doble-reserva)
- **Cache / broker:** Redis 7
- **Frontend:** React 18 · TypeScript · Vite · React Router (sin librería de UI ni de gráficos: design system propio con tokens de color)
- **Auth:** JWT con refresh, rotación y blacklist (`djangorestframework-simplejwt`)
- **Infra:** Docker + docker-compose, Nginx en producción
- **Calidad:** pytest + pytest-django + pytest-cov, ruff, mypy, vitest + Testing Library, pre-commit

Las decisiones y sus alternativas descartadas están en [`docs/adr-000-stack-tecnologico.md`](docs/adr-000-stack-tecnologico.md).

## Arquitectura

### Multitenancy (regla #1, no negociable)

Todos los datos de negocio se aíslan por `organization_id`. Estrategia del MVP: **base y esquema compartidos con discriminador**, con ruta de migración documentada a *schema-per-tenant* ([`docs/adr-001-estrategia-multitenant.md`](docs/adr-001-estrategia-multitenant.md)).

- Todo modelo de negocio hereda de `TenantAwareModel` (FK obligatoria a `Organization`).
- Un middleware resuelve la organización del usuario autenticado y la fija en el contexto de la request; `core.context.tenant_scope` cubre los casos fuera de una request HTTP (tests, comandos, tareas Celery).
- Los managers filtran por organización automáticamente. El acceso sin filtro existe solo para el superadministrador de plataforma y está marcado explícitamente en el código.
- **Nunca** se confía en un `organization_id` que venga del cliente; se toma siempre de la credencial autenticada.

### Capas

`vistas/serializers (I/O)` → `servicios/casos de uso (reglas de negocio)` → `ORM (persistencia)`.

Ninguna regla de negocio vive en vistas ni serializers. Los motores de disponibilidad y de reservas son componentes puros, independientes de la UI y del canal de entrada ([`docs/availability-engine.md`](docs/availability-engine.md), [`docs/booking-engine.md`](docs/booking-engine.md)).

### Módulos

El core es común; los módulos por rubro viven aislados en `backend/apps/modules/` y solo se exponen si la organización los tiene activados. Si un módulo no está activo, sus rutas devuelven `404` (no `403`, para no filtrar su existencia). El frontend condiciona el nav y protege las rutas de módulo. Ver [`docs/module-system.md`](docs/module-system.md).

| Módulo | Prefijo API | Recursos principales |
|---|---|---|
| `moto` — Taller de motos | `/api/modules/moto/` | Motos, historial de vehículo, órdenes de trabajo con máquina de estados |
| `laboratory` — Laboratorio clínico | `/api/modules/laboratory/` | Pacientes, pedidos, muestras, pruebas (pipeline de 7 etapas), resultados con permiso granular y lectura auditada |
| `store` — Tienda / lanzamientos | `/api/modules/store/` | Productos, variantes, inventario, lanzamientos, pedidos con control de stock |
| `legal` — Despacho de abogados | `/api/modules/legal/` | Casos, cronología, audiencias, tareas; alcance "solo mis casos" a nivel de queryset |

### Dos superficies de API separadas

- **API interna** (`/api/...`): la consume el frontend propio. Auth por JWT de usuario. Contrato en [`docs/api-interna.md`](docs/api-interna.md).
- **API pública de integración** (`/api/public/v1/...`): para terceros. API keys y OAuth2 client-credentials, scopes granulares, rate limiting por cliente, idempotencia, webhooks firmados con HMAC y OpenAPI publicado. Diseñada en [`docs/public-api.md`](docs/public-api.md); implementación en la Fase 12B.

Ambas superficies reutilizan los mismos casos de uso, para que la lógica de negocio no se duplique.

### Roles base (RBAC)

Superadministrador de plataforma · Administrador de empresa · Recepción · Profesional/empleado · Cliente. Los permisos son granulares (`recurso:accion`) y la matriz completa vive versionada en código como fuente de verdad ejecutable. Ver [`docs/auth-rbac.md`](docs/auth-rbac.md).

## Estructura del repositorio

```
backend/
  config/settings/{base,dev,prod,test}.py
  core/            modelos base, contexto y middleware de tenant, permisos,
                   excepciones, logging RFC 5424, registry de módulos, owner_access
  apps/
    authentication/ organizations/ branches/ users/
    customers/ services/ scheduling/ appointments/ payments/
    notifications/ documents/ tasks/ search/ reports/ audit/
    modules/{moto,laboratory,store,legal}/
  tests/           batería transversal (aislamiento multitenant, contexto, errores)
frontend/
  src/{api,components,features,routes,hooks,lib,types}/
docs/              ADRs, ERD, contratos de API, estándares, roadmap y checklist
docker-compose.yml
CLAUDE.md          instrucciones de arquitectura y convenciones del proyecto
```

## Puesta en marcha

### Requisitos

- Docker + Docker Compose (recomendado), o Python 3.11+ con PostgreSQL 16 y Redis 7 locales.
- Node.js 20+ para el frontend.

### Backend con Docker (recomendado)

Desde la raíz del repositorio:

```bash
docker compose up -d db redis
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py seed_rbac
docker compose run --rm backend python manage.py seed_demo   # datos de demostración
docker compose up -d backend celery_worker celery_beat
```

API en `http://localhost:8000/` · OpenAPI en `http://localhost:8000/api/docs/`.

### Backend sin Docker

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate      # Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # ajustar DB_HOST/DB_PORT a tu Postgres local
python manage.py migrate
python manage.py seed_rbac
python manage.py seed_demo
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # ajustar VITE_API_BASE_URL si el backend no está en localhost:8000
npm run dev
```

App en `http://localhost:5173`.

### Datos de demostración

`python manage.py seed_demo` crea organizaciones de rubros distintos, cada una con su módulo activado, clientes, servicios, profesionales, horario laboral y citas. Credenciales de ejemplo:

| Organización | Módulo | Usuario | Contraseña |
|---|---|---|---|
| Motors Ecuador | `moto` | `admin@motorsecuador.demo` | `Demo1234!` |
| Laboratorio ABC | `laboratory` | `admin@laboratorioabc.demo` | `Demo1234!` |
| UrbanStore | `store` | `admin@urbanstore.demo` | `Demo1234!` |
| Estudio Jurídico XYZ | `legal` | `admin@estudioxyz.demo` | `Demo1234!` |

Iniciar sesión con cuentas de organizaciones distintas es la forma más rápida de comprobar el aislamiento multitenant y el nav condicionado por módulo activo.

También puedes crear una organización desde cero:

```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"organization_name": "Mi Empresa", "email": "admin@miempresa.com", "password": "SuperSegura123!"}'
```

## Pruebas y calidad

```bash
# Backend
cd backend
pytest                                                # toda la suite
pytest --cov                                          # con cobertura
pytest tests/test_tenant_isolation.py -v              # aislamiento multitenant transversal
pytest apps/appointments/tests/test_concurrency.py -v # anti doble-reserva (concurrencia real)
ruff check . && ruff format --check .

# Frontend
cd frontend
npm run test        # vitest
npm run lint        # eslint
npx tsc -b          # type-check
```

Los tests de backend usan `config.settings.test` sobre PostgreSQL real (nunca SQLite: el motor de reservas depende de constraints propios de Postgres).

**Objetivos de cobertura:** ≥ 80 % global y ≥ 90 % en motores de disponibilidad/reservas, pagos y control de acceso. Estrategia completa —niveles ISTQB, técnicas de caja negra y blanca, criterios de entrada/salida por fase— en [`docs/test-plan.md`](docs/test-plan.md).

## Estándares transversales

Aplican a todo el código, en todas las fases. Están definidos en detalle en [`CLAUDE.md`](CLAUDE.md) y documentados en `docs/`:

- **Clean Code y SOLID**, separación estricta por capas, DRY/KISS/YAGNI.
- **Calidad ISO/IEC 25010** — objetivos medibles en [`docs/quality-iso25010.md`](docs/quality-iso25010.md).
- **Seguridad ISO/IEC 27001** — SoA técnico en [`docs/security-iso27001.md`](docs/security-iso27001.md); protección OWASP Top 10, secretos fuera del código, backups cifrados con restauración probada.
- **Gobierno COBIT 2019** y **ciberseguridad NIST CSF 2.0** — mapeados sobre el roadmap, el ERD, el RBAC y la auditoría inmutable.
- **Logging RFC 5424** — JSON estructurado, 8 niveles de severidad, correlation-id por request propagado a Celery, sin PII ni secretos ([`docs/logging.md`](docs/logging.md)). `AuditLog` es un canal aparte e inmutable.
- **Manejo de errores** — taxonomía de excepciones de dominio y exception handler global de DRF con formato uniforme `{code, message, details, request_id}` ([`docs/error-handling.md`](docs/error-handling.md)).
- **UX y accesibilidad** — WCAG 2.1 AA, modo claro/oscuro obligatorio con tokens de color (nunca colores hardcodeados), navegación por teclado en flujos críticos, responsive mobile-first en pantallas de cara al cliente.
- **TDD (Red-Green-Refactor)** para toda lógica de negocio; cada defecto corregido deja un test de regresión.

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/roadmap.md`](docs/roadmap.md) | MVP, funciones de 2ª etapa, riesgos, estado actual y próximos pasos |
| [`docs/checklist.md`](docs/checklist.md) | Detalle fase por fase de lo entregado |
| [`docs/erd.md`](docs/erd.md) | Modelo de datos completo (core + módulos) |
| [`docs/adr-000-stack-tecnologico.md`](docs/adr-000-stack-tecnologico.md) | ADR del stack |
| [`docs/adr-001-estrategia-multitenant.md`](docs/adr-001-estrategia-multitenant.md) | ADR de multitenancy |
| [`docs/api-interna.md`](docs/api-interna.md) · [`docs/public-api.md`](docs/public-api.md) | Contratos de las dos superficies de API |
| [`docs/availability-engine.md`](docs/availability-engine.md) · [`docs/booking-engine.md`](docs/booking-engine.md) | Motores de disponibilidad y reservas |
| [`docs/auth-rbac.md`](docs/auth-rbac.md) · [`docs/security-strategy.md`](docs/security-strategy.md) | Autenticación, roles y estrategia de seguridad |
| [`docs/module-system.md`](docs/module-system.md) | Sistema de módulos activables |
| [`docs/test-plan.md`](docs/test-plan.md) · [`docs/test-strategy-overview.md`](docs/test-strategy-overview.md) | Plan maestro de pruebas |
| [`docs/logging.md`](docs/logging.md) · [`docs/error-handling.md`](docs/error-handling.md) | Observabilidad y errores |
| [`docs/backup-strategy.md`](docs/backup-strategy.md) · [`docs/deployment-strategy.md`](docs/deployment-strategy.md) | Respaldo y despliegue |

Ver también [`backend/README.md`](backend/README.md) y [`frontend/README.md`](frontend/README.md) para el detalle operativo de cada lado.

## Contribuir

El proyecto avanza **una fase a la vez**: cada fase queda funcional, probada y documentada antes de empezar la siguiente.

- Migraciones se entregan junto con los modelos; nunca se dejan migraciones pendientes.
- Los commits siguen [Conventional Commits](https://www.conventionalcommits.org/).
- `pre-commit install` deja ruff y las validaciones básicas corriendo antes de cada commit.
- Ninguna fase se cierra con tests en rojo ni por debajo del umbral de cobertura.
