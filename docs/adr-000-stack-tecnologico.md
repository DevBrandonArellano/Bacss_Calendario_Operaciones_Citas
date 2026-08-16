# ADR-000: Stack tecnológico

**Estado:** Aceptado
**Fecha:** 2026-08-14
**Contexto de decisión:** Fase 1 — Arquitectura

## Contexto

La plataforma debe soportar múltiples empresas (multitenant), módulos especializados por rubro, una API interna consumida por un frontend propio, una API pública para terceros, procesamiento asíncrono (recordatorios, notificaciones, reportes) y un camino claro hacia convertirse en un SaaS comercial. El equipo prioriza velocidad de desarrollo inicial y bajo costo, sin sacrificar la capacidad de escalar o endurecer seguridad más adelante.

## Decisión

Se confirma el stack propuesto en `CLAUDE.md`, sin cambios:

| Capa | Elección | Alternativas consideradas | Motivo de la elección |
|---|---|---|---|
| Backend | Python 3.12 + Django 5 + DRF | Node/NestJS, FastAPI, Ruby on Rails | Django trae ORM maduro, sistema de auth/permisos, admin integrado (útil para operaciones internas/soporte) y un ecosistema probado de librerías multitenant (`django-tenants`, `django-guardian`). DRF da serialización, throttling, versionado y auth pluggable listos para usar. Reduce tiempo de desarrollo frente a armar equivalentes en FastAPI/Node. |
| Base de datos | PostgreSQL 16 | MySQL, MongoDB | Soporta JSONB (datos flexibles por módulo sin tabla por atributo), constraints e índices parciales/únicos (clave para anti-doble-reserva), y Row Level Security nativo si se necesita aislamiento reforzado a futuro sin cambiar de motor. |
| Frontend | React 18 + TypeScript + Vite | Django Templates + HTMX + Alpine, Vue | El spec exige reserva online pública, futuras apps móviles y API pública — es decir, la plataforma es API-first por requisito, no por preferencia. React+TS da tipado end-to-end y reutilización de lógica de UI para un eventual cliente móvil (React Native). **Alternativa de menor costo para MVP:** Django Templates + HTMX + Alpine evita mantener dos bases de código (API + SPA) y acelera el primer release; se documenta como opción válida si el objetivo inmediato es solo validar el negocio con un solo tipo de empresa, pero no cubre bien el requisito de app móvil/API pública a mediano plazo. Por defecto se usa React salvo indicación contraria explícita. |
| Tareas asíncronas | Celery + Redis | Django-Q, RQ, Dramatiq | Celery es el estándar de facto en el ecosistema Django, con soporte maduro para tareas periódicas (recordatorios), reintentos con backoff (webhooks) y monitoreo (Flower). Redis sirve doble propósito: broker de Celery y cache. |
| Auth | JWT + refresh (`djangorestframework-simplejwt`) sobre modelo de usuario personalizado | Sesiones Django clásicas, Auth0/Cognito externos | JWT es requisito natural para SPA + futura app móvil sin depender de cookies de sesión entre dominios. Un proveedor externo (Auth0/Cognito) se descarta para el MVP por costo y porque el modelo de roles es específico del dominio (multitenant + RBAC granular por módulo); se documenta como opción de migración futura si se requiere SSO empresarial. |
| Contenerización | Docker + docker-compose (dev/prod) + Nginx reverse proxy | Kubernetes desde el día uno | Docker Compose es suficiente para el volumen esperado en el MVP y mucho más barato de operar. Nginx como reverse proxy resuelve TLS, servir estáticos del frontend y enrutar `/api/` vs `/api/public/v1/`. Kubernetes queda como paso de escalamiento futuro (documentado en `docs/roadmap.md`), no como decisión de partida. |
| Calidad | pytest + pytest-django, ruff, mypy (parcial), pre-commit | unittest, flake8+black+isort por separado | ruff reemplaza flake8+black+isort+isort en una sola herramienta rápida, reduciendo configuración. mypy se aplica donde aporta más valor (servicios de dominio, motores de disponibilidad/reservas) sin exigir tipado estricto en todo el código desde el inicio, para no frenar velocidad de desarrollo. |

## Consecuencias

- **Positivas:** un solo lenguaje de backend, ecosistema maduro para todo lo crítico (auth, permisos, admin, ORM), curva de despliegue simple con Docker Compose, y un camino de escalamiento conocido (K8s, schema-per-tenant, read replicas) sin reescrituras.
- **Negativas / riesgos aceptados:** mantener dos bases de código (Django + React) implica más superficie de build/CI que una solución monolítica con templates; se acepta porque el requisito de API pública y app móvil lo justifica desde la Fase 1.
- **Revisión futura:** si el volumen de un tenant individual crece mucho más que el resto (ej. una cadena grande), se evaluará aislar esa organización en su propia infraestructura o base de datos — ver ADR-001.
