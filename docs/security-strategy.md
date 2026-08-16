# Estrategia de seguridad

Resumen ejecutivo; el detalle de controles vive en `docs/security-iso27001.md` y la auditoría formal en la Fase 13.

- **Autenticación:** hashing de contraseñas (Django, PBKDF2/Argon2), JWT con refresh y rotación, expiración corta de access token, blacklist de refresh tokens revocados.
- **Autorización:** RBAC de mínimo privilegio (`docs/auth-rbac.md`), validado en cada endpoint, nunca confiado del lado del cliente.
- **Aislamiento multitenant:** managers por defecto filtrados por `organization_id` resuelto del usuario autenticado (ADR-001); tests de aislamiento sistemáticos.
- **Transporte:** TLS obligatorio en producción (terminado en Nginx), sin excepciones para la API pública.
- **Entradas:** validación estricta en serializers DRF; uso exclusivo del ORM (sin SQL crudo interpolado) para prevenir inyección; sanitización de salida en el frontend para prevenir XSS; protección CSRF donde aplique (cookies) — la API JWT pura reduce superficie CSRF pero se mantiene la protección en cualquier vista que use cookies de sesión (p. ej. admin de Django).
- **Rate limiting:** reforzado en auth; por credencial en la API pública (`docs/public-api.md`).
- **Secretos:** fuera del código (variables de entorno / secret manager), nunca en el repositorio.
- **Auditoría:** `AuditLog` inmutable (sin `UPDATE`/`DELETE` desde la app) para acciones sensibles: login/logout, CRUD de datos críticos, descargas de documentos, cambios de permisos, cambios de estado de cita/pago/caso/resultado.
- **Dependencias:** revisión periódica de vulnerabilidades conocidas (SCA) y análisis estático (SAST) integrados a CI a partir de la Fase 2.
- **Datos sensibles:** los módulos laboratorio y legal reciben controles de acceso reforzados y auditoría de lectura, no solo de escritura.
