import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes } from "react-router-dom";

import { publicRoutes } from "@/routes/publicRoutes";
import { buildHeadTags, normalizeSiteUrl } from "@/seo/head";
import { PRIVATE_PAGE, PUBLIC_PAGES, findPublicPage } from "@/seo/pages";

const siteUrl = normalizeSiteUrl(import.meta.env.VITE_SITE_URL);

/** Rutas a pre-renderizar (SSG): exactamente las páginas indexables. */
export const publicPaths: string[] = PUBLIC_PAGES.map((page) => page.path);

/** Cuerpo HTML de una página pública. */
export function render(url: string): string {
  return renderToString(
    <MemoryRouter initialEntries={[url]}>
      <Routes>{publicRoutes}</Routes>
    </MemoryRouter>
  );
}

/** <head> propio de cada ruta pública (título, descripción, canonical, OG, JSON-LD). */
export function headFor(url: string): string {
  const page = findPublicPage(url);
  if (!page) throw new Error(`Sin metadatos SEO para la ruta pública ${url}`);
  return buildHeadTags(page, siteUrl);
}

/** <head> del shell de la app (rutas privadas): `noindex`, sin datos de la organización. */
export const privateHead: string = buildHeadTags(PRIVATE_PAGE, siteUrl);
