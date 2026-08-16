# Estrategia de despliegue (resumen)

El detalle operativo completo se produce en la Fase 14 (`docs/deployment.md`). Decisiones de arquitectura fijadas desde ahora:

- **Contenerización:** Docker para backend, frontend y worker de Celery; `docker-compose` para desarrollo y para el primer despliegue de producción (sin Kubernetes en el MVP — ver ADR-000).
- **Reverse proxy:** Nginx termina TLS, sirve el build estático del frontend, enruta `/api/` y `/api/public/v1/` al backend.
- **Configuración por entorno:** `config/settings/{base,dev,prod,test}.py` + variables de entorno para todo secreto/credencial; nada de configuración sensible hardcodeada.
- **Colas:** Redis + Celery worker(s) separados del proceso web, con beat para tareas periódicas (recordatorios).
- **CI/CD:** pipeline que corre lint + tests en cada cambio; el despliegue a producción queda gateado por esa verificación.
- **Observabilidad:** logging estructurado RFC 5424 desde el día uno (`docs/logging.md`); hook preparado para Sentry u equivalente antes de producción real.
- **Portabilidad:** todo el stack debe poder levantarse en cualquier proveedor que soporte Docker, sin atarse a servicios propietarios de un cloud específico en el MVP.
