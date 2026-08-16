# SoA técnico — ISO/IEC 27001 (Anexo A, controles técnicos aplicables)

La certificación ISO 27001 es organizacional; este documento mapea qué controles técnicos del Anexo A soporta o soportará el software, como insumo para esa certificación futura. Se actualiza en cada fase que implemente o afecte un control.

| Control (Anexo A) | Aplicable | Cómo lo soporta el software | Estado |
|---|---|---|---|
| A.5.15 Control de acceso | Sí | RBAC por rol (`docs/auth-rbac.md`), mínimo privilegio, revisión de permisos por endpoint | Diseñado (Fase 1); implementación Fase 2+ |
| A.5.16 Gestión de identidad | Sí | Modelo de usuario único por email, ciclo de vida (alta/baja/desactivación) gestionado por Admin de empresa | Fase 2 |
| A.5.17 Información de autenticación | Sí | Hashing de contraseñas, política de expiración/rotación de refresh tokens, recuperación de contraseña con token de un solo uso | Fase 2 |
| A.8.2 Gestión de accesos privilegiados | Sí | Acceso "sin filtro" de tenant solo para superadmin de plataforma, explícitamente marcado en código, uso auditado | Fase 2, reforzado Fase 13 |
| A.8.3 Restricción de acceso a la información | Sí | Managers tenant-aware por defecto; alcance "sobre lo propio" para profesional (`legal:read_all`, Fase 11 — un abogado sin ese permiso solo ve sus casos asignados; heredado por documentos/tareas del caso vía `core/owner_access.py`, Fase 11B; y por reportes/dashboard vía `employee_profile`, Fase 12) | Fase 2+, implementado a nivel de queryset desde Fase 11 |
| A.8.24 Uso de criptografía | Sí | TLS en tránsito (Nginx); hashing de contraseñas; secretos fuera del código; cifrado de backups en reposo | Fase 2 (hashing), Fase 14 (TLS/backups) |
| A.8.15 Registro (logging) | Sí | Logging estructurado RFC 5424 con correlation-id (`docs/logging.md`); `AuditLog` inmutable para acciones sensibles | Fase 2+ |
| A.8.16 Monitoreo de actividades | Parcial | Logs estructurados preparados para ingestión por herramienta de monitoreo/alertas (hook a Sentry en Fase 14) | Fase 14 |
| A.8.25 Ciclo de vida de desarrollo seguro | Sí | Validación de entrada en serializers, uso exclusivo del ORM, revisión de dependencias (SCA), SAST en CI | Fase 2+, formalizado Fase 13 |
| A.8.26 Requisitos de seguridad de aplicaciones | Sí | Protección OWASP Top 10 (inyección, XSS, CSRF, SSRF, deserialización insegura) revisada explícitamente en Fase 13 | Fase 13 |
| A.8.28 Codificación segura | Sí | Estándares de `CLAUDE.md` (sin SQL crudo, sin `except: pass`, taxonomía de excepciones) | Transversal |
| A.8.13 Respaldo de información | Sí | Backups cifrados con restauración probada (`docs/backup-strategy.md`) | Fase 14 |
| A.5.24-A.5.30 Gestión de incidentes | Parcial | Logging estructurado + auditoría como base para detección; plan formal de respuesta a incidentes queda fuera del alcance de software (proceso organizacional) | Fase 14 (hooks técnicos) |
| A.5.34 Privacidad y protección de PII | Sí | Aislamiento estricto por tenant (ADR-001); control de acceso a datos clínicos con permiso granular separado del acceso al pipeline general (`lab_results:read/write`, Fase 9 — corrigió una exposición real encontrada en esa fase); auditoría de lectura sobre `LabResult` (Fase 9) y de descargas de `Document` (Fase 11B) | Fase 2+, controles granulares desde Fase 9 |
| A.5.36 Cumplimiento de políticas de seguridad | Parcial | Este documento y `docs/security-review.md` (Fase 13) sirven de evidencia técnica; la política formal es responsabilidad organizacional | Fase 13 |

**Convención de estado:** "Diseñado" = decisión tomada y documentada en Fase 1; "Fase N" = se implementa en esa fase; "Parcial" = el software provee la base técnica pero el control completo requiere proceso organizacional adicional.
