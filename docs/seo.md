# SEO técnico y visibilidad en buscadores / IA

Estado: implementado 2026-10-24 para las páginas públicas. **No hay evidencia de indexación**: nada se ha enviado a Search Console y ninguna página ha sido inspeccionada por un buscador. Este documento describe lo que el código garantiza, no posiciones.

## Arquitectura

La app es un SPA (React + React Router + Vite). Para que los buscadores reciban contenido real sin ejecutar JavaScript, **las páginas públicas se pre-renderizan a HTML estático en el build** (`npm run build`):

1. `vite build` → bundle del cliente + `robots.txt`, `sitemap.xml`, `llms.txt` (plugin `frontend/build/seoPlugin.ts`).
2. `vite build --ssr src/entry-server.tsx` → bundle de servidor.
3. `scripts/prerender.mjs` escribe `dist/index.html`, `dist/funcionalidades/index.html`, `dist/para-negocios/index.html` (cada uno con su `<head>` propio) y `dist/app.html` (shell privado).

En el navegador, `main.tsx` **hidrata** solo si la ruta es una página pública (`findPublicPage`); cualquier otra ruta se monta desde cero. Una prueba (`hydration.test.tsx`) verifica que no haya desajustes de hidratación.

**Fuente única:** `frontend/src/seo/pages.ts` define título, descripción, H1 e indexabilidad de cada ruta; lo consumen el build, el pre-render y el cliente (`usePageMeta`). Una página pública nueva = una entrada en `PUBLIC_PAGES` + su ruta en `routes/publicRoutes.tsx`; aparece sola en sitemap, llms.txt y pre-render.

## Rutas públicas

| Ruta | Title | H1 | Indexación |
|---|---|---|---|
| `/` | Software de agendamiento de citas online \| Bacss Citas | Software de agendamiento de citas para tu negocio | index, follow |
| `/funcionalidades` | Funciones para gestionar citas y clientes \| Bacss Citas | Funciones para gestionar citas, clientes y horarios | index, follow |
| `/para-negocios` | Agendamiento de citas para tu rubro \| Bacss Citas | Software de citas para talleres, laboratorios, tiendas y despachos | index, follow |

Áreas privadas (`/login`, `/dashboard`, `/citas`, ...): `noindex, nofollow`, título genérico, **sin** canonical, Open Graph ni datos estructurados (`PRIVATE_PAGE`).

## Encabezados

Un único H1 por página, visible y con el texto de `pages.ts`; H2 por sección, H3 por tarjeta/pregunta, sin saltos de nivel (probado en `publicRoutes.test.tsx`). En el área privada, las tarjetas de indicadores no son encabezados y las gráficas del dashboard son H2 bajo el H1. El login usa `<p>` en su panel de marca para no anteponer un encabezado al H1 del formulario.

## Robots, sitemap, canonical

- `robots.txt`: `Allow: /`, `Disallow` solo de las rutas privadas (`PRIVATE_PATHS`) y línea `Sitemap`. Una prueba garantiza que ninguna página pública cae bajo un `Disallow`.
- `sitemap.xml`: solo páginas públicas canónicas; **sin `lastmod`** (no existe una fecha de modificación real y fiable; una fecha de build sería engañosa).
- `canonical` propio por página pública (nunca apunta a la home); `og:url` coincide.
- **Compromiso conocido:** el área privada usa `noindex` *y* `Disallow`. Un bot que respeta el `Disallow` no llega a leer el `noindex`; protege el rastreo, no sustituye a la autenticación. La protección real de los datos es la autenticación/autorización del backend (JWT), no el SEO.

## Datos estructurados (JSON-LD)

Solo lo que la página muestra: `Organization` + `WebSite` en todas las públicas; `SoftwareApplication` + `FAQPage` en la home (las preguntas salen de `seo/faq.ts`, la misma fuente que el texto visible; una prueba lo verifica); `BreadcrumbList` en subpáginas. **No se marcan** precios, valoraciones, direcciones ni horarios (no existen). El JSON se serializa escapando `<` y los metadatos se escapan como HTML (probado con título hostil).

## IA / agentes

HTML semántico, enlaces reales con `href`, contenido visible sin interacción ni login, FAQ con respuestas directas y honestas (p. ej. WhatsApp/SMS aún no disponibles). `llms.txt` se emite como complemento barato (resumen + enlaces); **no es requisito de indexación ni garantía de visibilidad**.

## Configuración de despliegue (pendiente del hosting)

1. **`VITE_SITE_URL`** (URL pública, sin barra final) en el entorno del build; sin ella los canonical/sitemap usan `http://localhost:5173`. Ver `frontend/.env.example`.
2. **Fallback del SPA a `/app.html`**, no a `/index.html` (que ahora es la home pre-renderizada). Nginx: `try_files $uri $uri/ /app.html;`. Vercel: rewrite de `/(.*)` a `/app.html` después de los archivos estáticos.
3. **Cabecera `X-Robots-Tag: noindex, nofollow`** para las rutas privadas y para `/app.html`, y respuestas `200` en las públicas. No se puede fijar desde el código del SPA.
4. **TLS/HTTPS y redirección** a un único host canónico (con/sin `www`).
5. Dar de alta el dominio en **Google Search Console** y **Bing Webmaster Tools** y enviar `sitemap.xml`.

## Pendiente / decisiones de negocio

- **`og:image`** (PNG 1200×630): requiere un recurso gráfico; hoy `twitter:card` es `summary`.
- **Página de precios:** no se creó; no hay planes ni precios definidos y no se inventan.
- **Reserva pública por negocio** (`/reservar/<negocio>`): no existe en el producto (Fase 15 pendiente); cuando exista, decidir indexabilidad y usar `LocalBusiness`/`Service` solo con datos reales.
- **Artículos/recursos y más páginas:** crear solo con contenido útil y original, no páginas artificiales.
- **Core Web Vitals / Lighthouse:** no medidos. El build es ligero (landing: CSS ~36 kB, JS principal ~358 kB sin comprimir; fuente Inter con `unicode-range`). Medir con PageSpeed/Lighthouse sobre el despliegue real y con datos de campo (p75).
- **Títulos por pantalla del área privada** (accesibilidad): hoy es un título genérico.
- hreflang: no aplica (un solo idioma, `lang="es"`).

## Verificación

`npx vitest run` (88 pruebas al cerrar esta etapa; 263 en total tras el rediseño de la Agenda, incluidas `seo.test.ts`, `publicRoutes.test.tsx`, `hydration.test.tsx`), `tsc -b`, `eslint .` y `npm run build` en verde. No se verificó con Search Console, Rich Results Test ni Lighthouse.
