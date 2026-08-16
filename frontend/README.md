# Frontend — Operaciones y Citas

React 18 + TypeScript + Vite. Consume la API interna del backend (`/api/...`) con JWT.

## Requisitos

- Node.js 20+.
- Backend corriendo en `http://localhost:8000` (ver `../backend/README.md`).

## Levantar el entorno

```bash
cd frontend
npm install
cp .env.example .env    # ajustar VITE_API_BASE_URL si el backend no está en localhost:8000
npm run dev
```

La app queda en `http://localhost:5173`.

## Probar el flujo de clientes

1. Levanta el backend y corre `python manage.py seed_demo` (crea `admin@motorsecuador.demo` / `Demo1234!`).
2. Abre `http://localhost:5173`, inicia sesión con esas credenciales.
3. En **Clientes**: lista con paginación, filtro por estado, orden por apellido/fecha, y búsqueda rápida por nombre/documento/teléfono/email.
4. "Nuevo cliente" crea; "Editar" modifica; "Eliminar" pide confirmación antes de borrar; "Historial" muestra la ficha agregada del cliente (se irá completando con citas/pagos/documentos en fases posteriores).
5. En **Servicios**: CRUD con duración y precio validados (no acepta duración ≤ 0 ni precio negativo), filtro por estado, orden por nombre/precio/duración.
6. En **Profesionales**: CRUD y, al editar, un checklist para asignar qué servicios puede prestar cada profesional (se guarda con `POST /api/employees/{id}/services/`).
7. En **Agenda**: vistas Día/Semana/Mes/Agenda por profesional; el seed crea horario lunes-viernes 09:00-18:00 y un par de citas confirmadas el próximo lunes.
8. "Nueva cita": elige sucursal, servicio y fecha; solo se pueden seleccionar los horarios que el motor de disponibilidad devuelve como libres (nunca uno ocupado). Luego busca el cliente y confirma.
9. Desde la agenda: "Confirmar"/"Iniciar"/"Completar" avanzan el estado; "Cancelar" pide un motivo; "Reprogramar" muestra los horarios libres de ese profesional en la nueva fecha elegida.

## Tests y calidad

```bash
npm run test        # vitest, corre una vez
npm run test:watch  # modo watch
npm run lint         # eslint
npx tsc -b           # type-check
```

## Estructura

```
src/
  api/          cliente axios con JWT (refresh automático) y normalización de errores
  components/   componentes compartidos (layout, diálogo de confirmación)
  features/
    auth/         contexto de sesión, login
    customers/    API, tipos y pantallas de clientes (Fase 3)
    services/      API y pantallas de servicios (Fase 4)
    employees/     API y pantallas de profesionales (Fase 4)
    branches/       API mínima de sucursales (para el selector de "Nueva cita")
    appointments/  API, calendario (Día/Semana/Mes/Agenda) y flujo de reserva/reprogramación (Fase 5)
  lib/          utilidades compartidas (tokens, fechas)
  routes/       ProtectedRoute
  types/        tipos compartidos (paginación, errores de API, citas, servicios, sucursales)
```
