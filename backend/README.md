# Backend — Operaciones y Citas

Django 5 + DRF, multitenant (ver `docs/adr-001-estrategia-multitenant.md`). Instrucciones de la Fase 2 (core, tenancy, usuarios, auth, RBAC), Fase 3 (clientes), Fase 4 (servicios y profesionales) y Fase 5 (agenda, disponibilidad y citas).

## Requisitos

- Docker + Docker Compose (recomendado), o Python 3.11+/3.12 con PostgreSQL 16 y Redis 7 locales.

## Levantar el entorno con Docker (recomendado)

Desde la raíz del repositorio:

```bash
docker compose up -d db redis
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py seed_rbac
docker compose up -d backend celery_worker celery_beat
```

La API queda disponible en `http://localhost:8000/`. Documentación OpenAPI en `http://localhost:8000/api/docs/`.

## Alternativa sin Docker (venv local)

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate   # Windows (PowerShell/Git Bash) — en Linux/Mac: source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env       # y ajustar DB_HOST/DB_PORT a tu Postgres local
python manage.py migrate
python manage.py seed_rbac
python manage.py runserver
```

## Crear una organización de prueba

Opción rápida (dos organizaciones demo de rubros distintos, como pide el criterio de éxito de `CLAUDE.md`):

```bash
python manage.py seed_demo
```

Crea:
- **Motors Ecuador** (módulo `moto`, 3 clientes, 3 servicios, 2 profesionales, horario lunes-viernes 09:00-18:00, 2 citas confirmadas el próximo lunes) — admin: `admin@motorsecuador.demo` / `Demo1234!`
- **Laboratorio ABC** (módulo `laboratory`, 2 clientes, 2 servicios, 1 profesional, mismo horario, 1 cita confirmada) — admin: `admin@laboratorioabc.demo` / `Demo1234!`

O manualmente vía API:

```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"organization_name": "Mi Empresa", "email": "admin@miempresa.com", "password": "SuperSegura123!"}'
```

Esto crea la organización y su primer usuario con rol `org_admin`.

## Correr los tests

```bash
cd backend
pytest                          # toda la suite
pytest --cov                    # con cobertura (docs/quality-iso25010.md: objetivo ≥80%, ≥90% en críticos)
pytest apps/branches -v         # una app puntual
pytest tests/test_tenant_isolation.py -v   # batería de aislamiento multitenant transversal
pytest apps/appointments/tests/test_concurrency.py -v   # anti doble-reserva (requiere transaction=True)
```

Los tests usan `config.settings.test` (PostgreSQL de test — DRF/Django crean y destruyen la base automáticamente vía `pytest-django`; no usar SQLite, ver `docs/test-plan.md`).

## Lint

```bash
ruff check .
ruff format --check .
```

## Qué incluye esta fase

- `core/`: `TimeStampedModel`, `SoftDeleteModel`, `TenantAwareModel` + managers (`core/models.py`), middleware de tenant y correlation-id (`core/middleware.py`), taxonomía de excepciones y exception handler global (`core/exceptions.py`, `core/exception_handler.py`), logging estructurado RFC 5424 (`core/logging.py`).
- `apps/organizations`: `Organization`, `ModuleActivation`, endpoint `GET/PATCH /api/organizations/me/`.
- `apps/branches`: `Branch` (CRUD), primer modelo `TenantAwareModel` real.
- `apps/users`: modelo de usuario personalizado, `Role`/`Permission` (RBAC), catálogo de permisos y roles de sistema (`manage.py seed_rbac`).
- `apps/authentication`: registro (crea organización + admin), login/logout JWT con rotación y blacklist, recuperación de contraseña, rate limiting en todos los endpoints de auth.
- `apps/audit`: `AuditLog` inmutable (sin `update`/`delete` desde la app), login/logout auditados.
- `apps/customers`: `Customer` (CRUD), búsqueda rápida (`GET /api/customers/search/?q=`), vista de historial (`GET /api/customers/{id}/history/`, se amplía en fases posteriores).
- `apps/services`: `Service` (duración/precio validados, único por organización) y `Employee` (vinculable a `User`, con sucursal), relación empleado↔servicios (`POST /api/employees/{id}/services/`).
- `apps/scheduling`: `Schedule` (horario recurrente de sucursal/empleado, con descansos) y `AvailabilityBlock` (vacaciones/feriados/bloqueos puntuales); motor de disponibilidad puro en `apps/scheduling/engine.py` (sin efectos secundarios), expuesto solo lectura en `GET /api/availability/`.
- `apps/appointments`: `Appointment` con máquina de estados (pendiente→confirmada→en proceso→completada, cancelación, no-show, reprogramación) y motor de reservas en `apps/appointments/services.py` (`CreateAppointmentUseCase`, 8 validaciones en orden) con protección anti doble-reserva en dos capas: locking pesimista (`select_for_update`) + `ExclusionConstraint` de PostgreSQL sobre un rango de tiempo (`time_range`, requiere la extensión `btree_gist`, habilitada automáticamente en la migración). Endpoints: crear, `confirm/`, `start/`, `complete/`, `no-show/`, `cancel/`, `reschedule/`.
- Tests: unitarios e de integración por app + batería transversal de aislamiento multitenant en `tests/` + test de concurrencia real con hilos y conexiones de base de datos separadas (`apps/appointments/tests/test_concurrency.py`).

## Frontend (React + TS + Vite)

Ver `frontend/README.md`. Consume esta API vía `/api/...` con JWT. Pantallas: login; Clientes (Fase 3); Servicios y Profesionales (Fase 4); Agenda con vistas Día/Semana/Mes/Agenda-por-profesional, reserva de citas (solo permite elegir horarios que el motor de disponibilidad marca como libres), confirmar/iniciar/completar/cancelar/reprogramar (Fase 5).
