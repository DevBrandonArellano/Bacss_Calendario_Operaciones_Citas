import { buildStructuredData } from "./structuredData.ts";
import { SITE_NAME, type PageSeo } from "./pages.ts";

export const DEFAULT_SITE_URL = "http://localhost:5173";

export function normalizeSiteUrl(siteUrl: string | undefined): string {
  return (siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

const ROBOTS_INDEXABLE = "index, follow, max-image-preview:large";
const ROBOTS_PRIVATE = "noindex, nofollow";

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function robotsFor(page: PageSeo): string {
  return page.indexable ? ROBOTS_INDEXABLE : ROBOTS_PRIVATE;
}

export function canonicalUrl(page: PageSeo, siteUrl: string): string {
  return page.path === "/" ? `${siteUrl}/` : `${siteUrl}${page.path}`;
}

function jsonLdScript(data: unknown): string {
  // `<` escapado para que el JSON nunca pueda cerrar el <script> (XSS).
  const json = JSON.stringify(data).replaceAll("<", "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * Etiquetas <head> específicas de una página. El área privada no lleva
 * canonical, Open Graph ni datos estructurados: solo título y `noindex`.
 */
export function buildHeadTags(page: PageSeo, siteUrl: string): string {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${robotsFor(page)}" />`,
  ];

  if (!page.indexable) return tags.join("\n    ");

  const url = canonicalUrl(page, siteUrl);
  tags.push(
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="es_ES" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    jsonLdScript(buildStructuredData(page, siteUrl))
  );
  return tags.join("\n    ");
}
