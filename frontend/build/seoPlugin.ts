import type { Plugin } from "vite";

import { buildHeadTags, normalizeSiteUrl } from "../src/seo/head.ts";
import { HOME_PAGE, PRIVATE_PATHS, PUBLIC_PAGES, SITE_NAME } from "../src/seo/pages.ts";

const HEAD_PLACEHOLDER = "<!--seo-head-->";

export const HEAD_START_MARKER = "<!--seo-head-start-->";
export const HEAD_END_MARKER = "<!--seo-head-end-->";

interface SeoPluginOptions {
  /** URL pública canónica (VITE_SITE_URL), sin barra final. */
  siteUrl?: string;
}

export function buildRobotsTxt(siteUrl: string): string {
  const disallowed = PRIVATE_PATHS.map((path) => `Disallow: ${path}`).join("\n");
  return `User-agent: *\nAllow: /\n${disallowed}\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

/** Sin `lastmod`: solo se publicaría una fecha de build, no una modificación real del contenido. */
export function buildSitemapXml(siteUrl: string): string {
  const urls = PUBLIC_PAGES.map((page) => {
    const loc = page.path === "/" ? `${siteUrl}/` : `${siteUrl}${page.path}`;
    return `  <url>\n    <loc>${loc}</loc>\n  </url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Resumen en texto plano para agentes de IA. Complemento opcional: no sustituye al sitemap ni al HTML. */
export function buildLlmsTxt(siteUrl: string): string {
  const links = PUBLIC_PAGES.map((page) => `- [${page.h1}](${siteUrl}${page.path}): ${page.description}`).join("\n");
  return `# ${SITE_NAME}\n\n> ${HOME_PAGE.description}\n\n## Páginas públicas\n\n${links}\n`;
}

/**
 * SEO en build: inyecta el <head> de la home en index.html (entre marcadores, para que el
 * pre-render lo reemplace por el de cada ruta) y emite robots.txt, sitemap.xml y llms.txt.
 * Los crawlers pueden indexar la parte pública; el área autenticada queda excluida.
 */
export function seoPlugin({ siteUrl }: SeoPluginOptions): Plugin {
  const resolvedSiteUrl = normalizeSiteUrl(siteUrl);

  return {
    name: "bacss-seo",
    transformIndexHtml: (html) =>
      html.replace(
        HEAD_PLACEHOLDER,
        `${HEAD_START_MARKER}\n    ${buildHeadTags(HOME_PAGE, resolvedSiteUrl)}\n    ${HEAD_END_MARKER}`
      ),
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: buildRobotsTxt(resolvedSiteUrl) });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: buildSitemapXml(resolvedSiteUrl) });
      this.emitFile({ type: "asset", fileName: "llms.txt", source: buildLlmsTxt(resolvedSiteUrl) });
    },
  };
}
