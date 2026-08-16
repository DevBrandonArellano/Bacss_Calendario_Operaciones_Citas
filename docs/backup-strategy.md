# Estrategia de backups

- **Alcance:** base de datos PostgreSQL completa (todas las organizaciones, dado el esquema compartido — ADR-001) y almacenamiento de documentos (`documents/`).
- **Frecuencia:** backup completo diario + WAL/incrementales continuos de PostgreSQL para permitir *point-in-time recovery*.
- **Cifrado:** backups cifrados en reposo; acceso restringido al equipo de infraestructura.
- **Retención:** política por definir con el negocio (mínimo sugerido: diarios 14 días, semanales 3 meses, mensuales 12 meses), documentada y ajustable por requisitos regulatorios de módulos sensibles (laboratorio).
- **Restauración probada:** un backup no probado no cuenta como confiable — se ejecuta un simulacro de restauración periódico (al menos trimestral) contra un entorno aislado, y se documenta el resultado. Este procedimiento se formaliza en la Fase 14 (`docs/deployment.md`).
- **Aislamiento de datos sensibles:** dado el esquema compartido, el backup completo contiene todos los tenants; el acceso a backups y a su restauración queda limitado a roles de infraestructura, no a administradores de organización individuales.
