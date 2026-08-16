# Estrategia de pruebas (resumen)

El detalle completo (niveles ISTQB, técnicas de caja negra/blanca, criterios de entrada/salida, datos de prueba) vive en `docs/test-plan.md`. Resumen ejecutivo:

- **TDD por defecto** en toda lógica de negocio: test que falla → código mínimo → refactor.
- **Pirámide de pruebas:** mayoría de tests unitarios (servicios, motores de disponibilidad/reservas), capa media de integración (API + base de datos real de test), pocos E2E (flujos completos multi-endpoint).
- **Cobertura mínima:** ≥ 80% global, ≥ 90% en motores de disponibilidad/reservas, pagos y control de acceso.
- **Aislamiento multitenant como caso de prueba transversal:** cada fase que agrega un recurso nuevo agrega también su test de "Empresa A no ve datos de Empresa B" para ese recurso.
- **Herramientas:** pytest + pytest-django, `pytest-cov` para cobertura, `factory_boy`/fixtures para datos de prueba, base de datos de test PostgreSQL real (no SQLite) para que los constraints de concurrencia/exclusión se comporten igual que en producción.
- **CI:** lint (ruff) + tests corren en cada push/PR desde la Fase 2 en adelante; un fallo bloquea el merge.
