# Plan Maestro de Pruebas (ISTQB)

## Niveles de prueba

| Nivel | Alcance | Herramienta | Cuándo |
|---|---|---|---|
| Unitaria (componente) | Funciones/clases aisladas: servicios de dominio, motor de disponibilidad, motor de reservas, validadores | pytest, sin base de datos donde sea posible (mocks de repositorio) o con `pytest-django` en modo transaccional | Cada fase, TDD |
| Integración | Interacción entre componentes: caso de uso + ORM + base de datos real de test, managers tenant-aware, middleware | pytest-django con PostgreSQL de test | Cada fase |
| Sistema (API E2E) | Flujo HTTP completo: request → auth → permisos → vista → servicio → base de datos → respuesta | `APIClient` de DRF, `pytest-django` | Cada fase, sobre los endpoints nuevos |
| Aceptación | Criterios de negocio del spec (p. ej. "un usuario de la Empresa A nunca ve datos de la Empresa B") | Tests E2E etiquetados como aceptación, mapeados 1:1 a un criterio del spec de la fase | Cada fase, antes de cerrarla |

Pirámide de pruebas: mayoría unitarias, capa media de integración, pocos E2E — los E2E cubren flujos críticos completos (reserva de cita, activación de módulo, doble reserva concurrente), no cada combinación posible.

## Técnicas de caja negra (basadas en especificación)

- **Particiones de equivalencia:** p. ej. para duración de servicio (positiva válida / cero / negativa / no numérica), para email de cliente (válido / formato inválido / vacío), para rol de usuario (cada uno de los 5 roles como partición separada de permisos).
- **Análisis de valores límite:** duraciones de cita en el borde exacto del horario laboral (empieza justo al abrir, termina justo al cerrar, un minuto antes/después); solapamiento de horarios en el límite exacto (cita termina exactamente cuando otra empieza — no es conflicto; termina un minuto después — sí es conflicto).
- **Tablas de decisión:** reglas de disponibilidad (combinaciones de horario base × descanso × bloqueo × cita existente → slot disponible o no) y reglas de permisos (rol × recurso × acción → permitido/denegado), incluida la matriz de `docs/auth-rbac.md`.
- **Transición de estados:** cobertura de las máquinas de estado de `Appointment` (`docs/booking-engine.md`), `WorkOrder`, `LabOrder`/`LabTest`/`Sample`, `Order`, `LegalCase` — tanto transiciones válidas como intentos de transición inválida (deben rechazarse con `ConflictError`).

## Técnicas de caja blanca (basadas en estructura)

- Cobertura de sentencias y de ramas medida con `pytest-cov`.
- Foco explícito en cubrir todos los caminos de decisión de los motores de disponibilidad y reservas (cada validación de la lista 1-8 del motor de reservas debe tener al menos un test que la haga fallar y uno que la pase).
- Revisión de complejidad ciclomática (objetivo ≤ 10 por función, `docs/quality-iso25010.md`) como proxy de cuántos caminos hay que cubrir.

## TDD (Red-Green-Refactor)

Para toda lógica de negocio nueva: (1) escribir el test que falla, (2) escribir el código mínimo que lo hace pasar, (3) refactorizar manteniendo los tests en verde. Cada fase muestra los tests junto con o antes que la implementación correspondiente.

## Cobertura mínima

- ≥ 80% global del backend.
- ≥ 90% en: motor de disponibilidad, motor de reservas, módulo de pagos, capa de control de acceso (permission classes, managers tenant-aware).

## Criterios de entrada/salida por fase

- **Entrada:** la fase anterior está cerrada (tests en verde, `docs/` actualizado); los modelos/servicios de los que depende la fase actual existen.
- **Salida:** todos los tests de la fase (unitarios, integración, sistema, aceptación) pasan; cobertura dentro del umbral; no hay migraciones pendientes; `docs/` actualizado; commit propuesto.

## Gestión de defectos

Todo defecto encontrado (en desarrollo, revisión o en la auditoría de Fase 13) se reproduce primero con un test que falla (test de regresión), luego se corrige el código hasta que ese test pasa. El test de regresión permanece en la suite indefinidamente.

## Datos de prueba

- Datos ficticios generados por fixtures de pytest (`conftest.py` por app, creación directa vía `Model.objects.all_objects.create(...)`), nunca datos reales de clientes. `factory_boy` no se adoptó en la práctica — las fixtures directas resultaron suficientes y más explícitas para este tamaño de suite; se reconsideraría solo si la duplicación entre `conftest.py` crece demasiado.
- Cada fase mantiene y amplía un comando de seed/demo (`manage.py seed_demo`) con organizaciones de rubros distintos para poder probar aislamiento multitenant de forma manual y automatizada (ver criterio de éxito general en `CLAUDE.md`): "Motors Ecuador" (Taller), "Laboratorio ABC" (Laboratorio), "UrbanStore" (Tienda, Fase 10) y "Estudio Jurídico XYZ" (Legal, Fase 11).
- Datos sensibles de los módulos laboratorio/legal en el seed son siempre ficticios y claramente identificables como tales (nombres de prueba, no combinaciones que parezcan datos reales).
