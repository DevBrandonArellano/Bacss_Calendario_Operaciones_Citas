import { useEffect } from "react";

import { canonicalUrl, normalizeSiteUrl, robotsFor } from "@/seo/head";
import type { PageSeo } from "@/seo/pages";

function upsertMeta(attribute: "name" | "property", key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(href: string | null): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    existing?.remove();
    return;
  }
  const link = existing ?? document.head.appendChild(document.createElement("link"));
  link.setAttribute("rel", "canonical");
  link.setAttribute("href", href);
}

function siteUrl(): string {
  return normalizeSiteUrl(import.meta.env.VITE_SITE_URL ?? window.location.origin);
}

/**
 * Mantiene el <head> coherente con la ruta actual en la navegación del cliente. El
 * <head> inicial de las páginas públicas ya viene correcto del pre-render; esto evita
 * que los metadatos de una página se filtren a la siguiente al navegar sin recargar.
 */
export function usePageMeta(page: PageSeo): void {
  useEffect(() => {
    document.title = page.title;
    upsertMeta("name", "description", page.description);
    upsertMeta("name", "robots", robotsFor(page));

    if (page.indexable) {
      const url = canonicalUrl(page, siteUrl());
      setCanonical(url);
      upsertMeta("property", "og:title", page.title);
      upsertMeta("property", "og:description", page.description);
      upsertMeta("property", "og:url", url);
      upsertMeta("name", "twitter:title", page.title);
      upsertMeta("name", "twitter:description", page.description);
    } else {
      setCanonical(null);
    }
  }, [page]);
}
