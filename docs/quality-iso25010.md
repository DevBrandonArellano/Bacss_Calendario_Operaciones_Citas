# Plan de calidad — ISO/IEC 25010

Objetivos medibles por característica. Se revisan al cierre de cada fase (criterio de "fase terminada" en `CLAUDE.md`).

| Característica | Objetivo medible | Cómo se verifica |
|---|---|---|
| 1. Adecuación funcional | 100% de los criterios de aceptación del spec de la fase cubiertos por al menos un test de aceptación/E2E | Suite de tests de aceptación por fase (`docs/test-plan.md`) |
| 2. Eficiencia de desempeño | p95 de endpoints CRUD < 300 ms bajo carga de datos demo; 0 consultas N+1 detectadas en endpoints de listado; paginación obligatoria en todo endpoint de lista | `django-silk`/`nplusone` en dev, revisión de `EXPLAIN ANALYZE` en consultas críticas (disponibilidad, reportes), tests de performance puntuales en motores críticos |
| 3. Compatibilidad | API pública versionada sin breaking changes dentro de `v1`; contrato OpenAPI válido y estable | Generación de OpenAPI en CI + diff de contrato entre versiones |
| 4. Usabilidad | Mensajes de error entendibles (formato uniforme, sin jerga técnica ni stack traces); UI responsive (mobile/desktop) en flujos clave (agenda, reserva) | Revisión manual de UX por fase; checklist de accesibilidad básica (contraste, labels de formularios) |
| 5. Fiabilidad | 0 excepciones no manejadas devueltas como 500 sin logging; backups restaurables probados al menos trimestralmente | Exception handler global (`docs/error-handling.md`); simulacro de restauración (`docs/backup-strategy.md`) |
| 6. Seguridad | 0 hallazgos críticos/altos abiertos en la revisión de seguridad (Fase 13); 100% de acciones sensibles auditadas | `docs/security-review.md` (Fase 13), checklist OWASP Top 10 |
| 7. Mantenibilidad | Cobertura ≥ 80% global, ≥ 90% en componentes críticos; complejidad ciclomática por función ≤ 10; 0 lógica de negocio en vistas/serializers (verificado por revisión) | `pytest-cov`, `ruff`/complexity linter, revisión de arquitectura por capas |
| 8. Portabilidad | El stack completo levanta con `docker-compose up` en un entorno limpio sin pasos manuales adicionales; toda config sensible vía variables de entorno | Verificación manual en Fase 2 y Fase 14; `docker-compose config` en CI |

Estos objetivos se revisan y ajustan si la experiencia de una fase muestra que un umbral es poco realista; cualquier ajuste se documenta aquí con la razón.
