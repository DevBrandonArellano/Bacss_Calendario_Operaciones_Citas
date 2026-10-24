# Sistema de diseño del frontend

Estado: vigente desde 2026-10-24 (paleta y Agenda/Dashboard actualizados el mismo día). Cumple el estándar de UX de `CLAUDE.md` (tokens de color, modo claro/oscuro, WCAG 2.1 AA, responsive).

## Stack visual

- **Tailwind CSS v4** (`@tailwindcss/vite`), tipografía **Inter** autoalojada (`@fontsource-variable/inter`, sin peticiones externas) e iconos **lucide-react** (decorativos con `aria-hidden`).
- Utilidades auxiliares: `clsx` + `tailwind-merge` en `src/lib/cn.ts` (la última clase gana ante conflictos).
- Gráficos propios en HTML/CSS/SVG (`src/components/charts/`), sin librería de gráficos.

## Tokens y modo claro/oscuro

Los tokens viven en `frontend/src/index.css`:

1. **Variables CSS por modo** definidas en `:root` (claro), bajo `prefers-color-scheme: dark` (sin override manual) y bajo `:root[data-theme="dark"|"light"]` (override de `useTheme`/`ThemeToggle`). Los bloques se generaron desde una sola tabla para que los dos modos no diverjan.
2. **`@theme inline`** las expone como utilidades de Tailwind con nombres semánticos: `bg-page`, `bg-chrome` (barras lateral y superior), `bg-surface`, `bg-raised` (paneles y diálogos), `bg-subtle`, `text-ink`, `text-muted`, `border-line`, `bg-brand`, `bg-brand-soft`, `text-on-brand`, `text-negative`/`positive`/`caution` (+ `-soft`) y los de estado de cita (abajo).

Un componente **no necesita `dark:`**: los tokens cambian con el tema. Regla: ningún componente usa colores literales de Tailwind (`bg-white`, `text-gray-500`...).

### Paleta (según la especificación de producto)

| Token | Claro | Oscuro |
|---|---|---|
| Fondo (`page`) | `#F5F7FB` | `#0B1020` |
| Navegación (`chrome`) | `#FFFFFF` | `#141B2F` |
| Superficie (`surface`) | `#FFFFFF` | `#151D32` |
| Elevada / secundaria (`raised`, `subtle`) | `#F1F5F9` | `#1C2742` |
| Borde (`line`) | `#E2E8F0` | `#293653` |
| Texto (`ink`) | `#0F172A` | `#F8FAFC` |
| Texto secundario (`muted`) | `#5B6B82` ⚠ | `#A6B4CF` |
| Primario (`brand`) | `#5145FF` | `#818CF8` (activo `#6366F1`) |
| Primario suave (`brand-soft`) | `#ECEBFF` | `#222A54` ⚠ |

⚠ **Desviaciones deliberadas para cumplir WCAG AA** (medidas con la fórmula de luminancia y con axe-core): el gris secundario del tema claro propuesto (`#64748B`) da 4,34:1 sobre el fondo secundario, así que se usa `#5B6B82` (≥ 4,95:1); y el fondo suave del tema oscuro pasó de `#262F5E` a `#222A54` porque el texto primario sobre él daba 4,27:1.

### Estados de cita

Cada estado tiene tres tokens por modo: `--status-X` (acento: barras y puntos, el color de la especificación), `--status-X-fg` (texto, ≥ 4,5:1) y `--status-X-bg` (fondo tenue, mezcla del acento con la superficie). Significado único en toda la app (`features/appointments/status.ts`):

| Estado | Acento oscuro | Acento claro | Icono |
|---|---|---|---|
| Confirmada | `#22C55E` | `#16A34A` | check en círculo |
| Pendiente / En espera | `#F59E0B` | `#D97706` | reloj / reloj de arena |
| En proceso | `#818CF8` | `#4F46E5` | play |
| Completada | `#38BDF8` | `#0284C7` | doble check |
| Cancelada | `#F87171` | `#DC2626` | X en círculo |
| No asistió (la «rechazada» del dominio) | `#EF4444` | `#B91C1C` | usuario tachado |
| Reprogramada | `#94A3B8` | `#64748B` | calendario con reloj |

El color nunca es la única señal: cada estado también lleva icono y texto. El modelo del backend no tiene estado «Rechazada»; «No asistió» ocupa ese color. Las transiciones válidas las define el backend (`VALID_TRANSITIONS`) y la UI las refleja en `agenda/appointmentActions.ts`.

## Espaciado, grid y composición

- Escala de **4 px** de Tailwind (`gap-1`=4, `gap-2`=8, `gap-3`=12, `p-4`=16, `gap-6`=24, `py-8`=32).
- Escritorio: **barra lateral de 256 px** (72 px colapsada, preferencia guardada en el navegador, con tooltips accesibles), **barra superior de 64 px** y contenedor `max-w-7xl`. Móvil (< 1024 px): la barra lateral es un menú desplegable (`aria-expanded`, `aria-controls`).
- Dashboard y formularios: **rejilla de 12 columnas** (4 indicadores 3+3+3+3; gráficos 8+4 y 4+8) con tarjetas de igual altura.
- Escala tipográfica: título de página 30 px, sección 16-20 px, tarjeta 14-16 px, interfaz 14 px, auxiliar 12 px.

## Componentes

| Componente | Rol |
|---|---|
| `ui/buttonStyles`, `Button` | Estilos de botón (`primary`, `secondary`, `ghost`, `danger`; `sm`, `md`, `lg`), sirven también para `<Link>`. |
| `ui/Card`, `PageHeader`, `StatCard`, `Delta` | Superficies, encabezado de página, indicador con icono y variación frente al período anterior (texto + icono; no inventa una variación si no hay base). |
| `ui/EmptyState` | Estado vacío o de error con icono, explicación y acciones. |
| `ui/ResourceView` | Presenta cargando (esqueleto) / error (con reintento) / listo; un error de red nunca se muestra como «no hay datos». |
| `ui/Drawer`, `ui/Dialog` | Panel lateral y diálogo modal con foco atrapado, Escape y retorno de foco (`useModalA11y`). |
| `ui/Field` | Etiqueta + control + ayuda/error asociados por `aria-describedby`. |
| `charts/BarChart`, `LineChart` | Gráficos con ejes de escala «bonita» (enteros para conteos), tooltip, un solo punto de tabulación y flechas para recorrerlos. |
| `components/navigation`, `SidebarNav`, `TopBar`, `AppLayout` | Menú por secciones y módulos activos, título contextual, notificaciones sin leer, perfil y tema. |

## Cómo se usa el patrón en Dashboard y Agenda

- **Datos:** `hooks/useAsyncResource` (descarta respuestas antiguas, conserva datos mientras recarga la misma consulta) y `lib/pagination.fetchAllPages` (recorre todas las páginas; la API pagina de 20 en 20).
- **Hora del negocio:** «hoy» y la línea de hora actual salen de la zona horaria de la empresa (`lib/businessTime`, `hooks/useBusinessNow`), no de la del navegador.
- **Agenda:** el estado (vista, fecha, filtros, cita abierta) vive en la URL (`agenda/agendaUrl.ts`) y es compartible. Lógica pura y probada aparte de la UI: `agendaRange`, `timeGrid`, `scheduleSegments`, `grouping`, `appointmentActions`.

## Migración

Convivencia deliberada: el CSS legado de las pantallas aún no migradas está en `@layer components`, de menor prioridad que las utilidades de Tailwind. **Migradas:** login, layout/navegación, **Dashboard, Agenda (Día, Semana, Mes, Por profesional, Lista), Nueva cita**, páginas públicas. **Pendientes:** clientes, servicios, profesionales, pagos, notificaciones, reportes y los módulos taller, laboratorio, tienda y legal (siguen con estilos globales coherentes pero sin componentes `ui/`). Al migrar una pantalla, borrar del CSS legado las clases que deje de usar.

## Verificación

- axe-core (WCAG 2.0 A/AA y 2.1 AA, incluye contraste) sobre login, Dashboard, Agenda (4 vistas + detalle) y Nueva cita, en claro y oscuro: **0 violaciones** (2026-10-24). Se ejecutó con Edge headless contra la app en desarrollo; no forma parte del CI.
- Recorrido de extremo a extremo con el backend real (crear, editar notas, reprogramar, cancelar, filtros, teclado): 17/17.
- Capturas en escritorio y móvil, claro y oscuro, revisadas manualmente.

## Limitaciones conocidas

- Las acciones destructivas de otras pantallas (reembolsar, eliminar) aún no usan la variante `danger`.
- No hay arrastrar y soltar para reprogramar (opcional en la especificación): se reprograma desde el panel de la cita, con formulario y teclado.
- Hacer clic en un hueco libre del calendario solo funciona con ratón; el equivalente con teclado es el botón «Nueva cita».
- No se midió Lighthouse ni Core Web Vitals.
