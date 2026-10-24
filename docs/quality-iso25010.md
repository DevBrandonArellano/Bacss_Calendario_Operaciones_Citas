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

## Resultados medidos — Dashboard y Agenda (2026-10-24)

| Característica | Objetivo | Resultado | Cómo se midió |
|---|---|---|---|
| Usabilidad / accesibilidad | 0 violaciones WCAG 2.1 AA en pantallas nuevas | **0** en 8 pantallas × claro y oscuro (login, Dashboard, Agenda semana/día/mes/lista, detalle de cita, Nueva cita) | axe-core con Edge headless; incluye contraste real. Manual, fuera del CI |
| Usabilidad / teclado | Flujos críticos sin ratón | Recorrer gráficos con flechas, abrir/cerrar el panel de la cita con Enter/Escape con retorno de foco, crear la cita desde el formulario | Recorrido E2E 17/17 + pruebas de componentes |
| Eficiencia de desempeño | Sin N+1 en listados | Lista de citas con nombres en ≤ 12 consultas con 5 o más citas (no crece con el número de citas) | `django_assert_max_num_queries` |
| Fiabilidad | Un fallo no se confunde con «sin datos» | Error de red, 403, filtros sin resultados y período vacío se muestran por separado; datos de otra consulta nunca se usan como actuales | Pruebas de `CalendarPage` y `DashboardPage` |
| Adecuación funcional | Cifras comparables y veraces | Variación solo con base de comparación; «hoy» según la zona horaria de la empresa | Pruebas de `period`, `format` y `business_today` |
| Mantenibilidad | Lógica fuera de la UI | Rangos, rejilla horaria, URL, acciones por estado y agrupación en módulos puros con pruebas unitarias | `features/appointments/agenda/*.test.ts` |
| Eficiencia (front) | Core Web Vitals (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1) | **Sin medir** | Pendiente: Lighthouse y datos de campo sobre el despliegue real |
