# ADR-002: Viabilidad de desplegar el stack completo en Vercel

## Estado

Propuesto — **no implementado**. Documenta la investigación pedida por el usuario (2026-08-25) sobre si el
stack completo (Django + DRF + PostgreSQL + Redis + Celery worker/beat + React) puede vivir enteramente en
Vercel, y qué costaría hacerlo.

## Contexto

ADR-000 fijó Docker + docker-compose como estrategia de despliegue, con el objetivo explícito de
**portabilidad**: "todo el stack debe poder levantarse en cualquier proveedor que soporte Docker, sin
atarse a servicios propietarios de un cloud específico" (`docs/deployment-strategy.md`). El proyecto usa
Celery + Redis con `beat` para recordatorios periódicos (`docker-compose.yml`: servicios `celery_worker` y
`celery_beat`), y PostgreSQL 16 con `btree_gist` para el `ExclusionConstraint` anti doble-reserva.

Vercel en 2026 dejó de ser solo un host de frontend/Next.js: ahora soporta Django nativamente (WSGI/ASGI)
como Vercel Functions, y Celery mediante Vercel Queues (`vercel://` broker) — ver
[docs/frameworks/full-stack/django](https://vercel.com/docs/frameworks/full-stack/django) y
[docs/frameworks/backend/celery](https://vercel.com/docs/frameworks/backend/celery) (verificado
2026-08-25). Esto cambia la pregunta de "¿es posible?" a "¿vale la pena, dado lo que cuesta?".

## Qué sí funcionaría tal cual (o casi)

- **Backend Django/DRF** como Vercel Function (WSGI): Vercel detecta `manage.py`, lee
  `WSGI_APPLICATION` de settings, corre `collectstatic` automáticamente. DRF corre sobre WSGI sin cambios.
- **Frontend React**: como un "Service" separado dentro del mismo proyecto Vercel (`/docs/services`), o
  como proyecto Vercel independiente apuntando al backend por `VITE_API_BASE_URL`. Esto es exactamente lo
  que ya hacen `Bacss_Calculadora_finanzas` y `Bacss_Gestion_presupuestaria`.
- **PostgreSQL**: vía integración del Vercel Marketplace (Neon, Supabase o AWS Aurora Postgres — Vercel ya
  no ofrece Postgres propio, lo delegó a terceros en diciembre 2024). Neon y Supabase soportan `btree_gist`
  y `ExclusionConstraint`, así que el motor anti doble-reserva no se pierde. Requiere connection pooling
  (pgbouncer/pooler) porque las funciones serverless abren/cierran conexiones por invocación — mismo patrón
  que ya usa `Bacss_Gestion_presupuestaria` con el pooler de Supabase en el puerto 6543.

## Qué requeriría reescritura real (no configuración)

1. **Celery Beat no puede correr en Vercel.** `celery beat` es un proceso de larga duración; Vercel no
   ejecuta procesos persistentes. La documentación oficial dice explícitamente: reemplazar `celery beat`
   por **Vercel Cron Jobs** que llaman una ruta que encola las tareas. Esto significa reescribir el
   scheduling de recordatorios (`celery_beat` en `docker-compose.yml`) como uno o más endpoints HTTP
   protegidos (patrón `CRON_SECRET`, igual al que ya implementa `Bacss_Gestion_presupuestaria` en
   `app/api/cron/alerts/route.ts`) invocados por cron de Vercel.
2. **El broker de Celery cambia de Redis a Vercel Queues.** `broker="vercel://"` reemplaza la URL de Redis;
   Vercel provee las credenciales automáticamente, no hace falta Redis propio para esto. Pero el *result
   backend* recomendado (`vercel-runtime-cache://`) es efímero y regional — solo sirve para estado de
   tarea de corta vida, no para nada que necesite durar. Si algo del proyecto depende de leer resultados de
   tareas más tarde, hace falta un backend durable aparte (Postgres o Redis externo).
3. **`django-redis` (cache) pierde su Redis.** El Redis actual del `docker-compose.yml` cubre dos roles:
   broker de Celery y cache de Django. Vercel Queues resuelve el primero pero no es un cache de propósito
   general. Haría falta Redis externo (Vercel KV/Upstash, o un Redis administrado) solo para el cache, o
   migrar el cache a otra estrategia.
4. **Los "workers" dejan de ser procesos persistentes con estado.** Cada tarea de Celery corre como una
   invocación de función independiente disparada por cola — sin control de proceso, sin `celery worker`
   real, sin comandos de control de worker. Para las tareas de este proyecto (recordatorios por email,
   principalmente) esto es funcionalmente equivalente, pero es un cambio de modelo de ejecución, no un
   ajuste de configuración.
5. **Pierde el objetivo explícito de portabilidad de ADR-000.** `vercel://` como broker, Vercel Queues,
   Vercel Cron y el Runtime Cache son todos propietarios de Vercel — el proyecto dejaría de poder
   levantarse "en cualquier proveedor que soporte Docker" sin reescribir de nuevo la capa de tareas
   asíncronas. Esto es una decisión de arquitectura, no un detalle técnico, y contradice directamente lo
   que ADR-000 fijó como objetivo.

## Alternativa recomendada (sin reescribir Celery)

Separar frontend de backend, no forzar todo a Vercel:

- **Frontend React → Vercel** (o donde ya esté pensado desplegarse el resto del ecosystem BACSS): es la
  parte que Vercel hace mejor y sin fricción, igual que los otros dos proyectos de este workspace.
- **Backend Django + Celery worker + Celery beat + Postgres + Redis → un proveedor que corra
  `docker-compose` tal cual**: Railway, Render, Fly.io o un VPS. El `docker-compose.yml` actual ya está
  listo para esto casi sin cambios (Render y Railway soportan Dockerfiles/compose directamente). Esto
  preserva el motor de disponibilidad/reservas contra Postgres real con `btree_gist`, mantiene Celery beat
  como proceso real (sin reescribir el scheduling), y no rompe el objetivo de portabilidad de ADR-000.

## Decisión

**No implementada todavía.** Migrar el backend completo a Vercel Functions + Queues + Cron es *posible*
pero implica: reescribir el scheduling de recordatorios como cron+endpoint, resolver un cache/result
backend durable aparte, y abandonar el objetivo de portabilidad de ADR-000 — trabajo de arquitectura no
trivial, no una tarea de "configurar el despliegue". Requiere además provisionar cuentas/credenciales
nuevas (Neon o Supabase, y opcionalmente Vercel KV) que no pueden crearse sin decisión y acceso del
usuario.

Queda pendiente de decisión: ¿se prioriza la alternativa recomendada (frontend en Vercel, backend en un
proveedor Docker-friendly), o se acepta el costo de reescritura para tener todo en Vercel?

## Referencias

- [Deploy a Django app on Vercel](https://vercel.com/docs/frameworks/full-stack/django) (verificado 2026-08-25)
- [Run background tasks with Celery on Vercel](https://vercel.com/docs/frameworks/backend/celery) (verificado 2026-08-25)
- [Vercel Postgres Transition Guide (Neon)](https://neon.com/docs/guides/vercel-postgres-transition-guide)
- `docs/adr-000-stack-tecnologico.md`, `docs/deployment-strategy.md` (decisiones que este ADR pone en tensión)
