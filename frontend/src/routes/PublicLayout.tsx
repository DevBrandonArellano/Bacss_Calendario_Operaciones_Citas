import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { PublicFooter, PublicHeader } from "@/features/landing/sections";
import { HOME_PAGE, findPublicPage } from "@/seo/pages";
import { usePageMeta } from "@/seo/usePageMeta";

/** Chrome compartido de las páginas públicas (también lo usa el pre-render). */
export function PublicLayout() {
  const { pathname, hash } = useLocation();
  usePageMeta(findPublicPage(pathname) ?? HOME_PAGE);

  // BrowserRouter no hace scroll a anclas (p. ej. "/#preguntas") al navegar en el cliente.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [pathname, hash]);

  return (
    <div className="min-h-screen bg-page text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <PublicHeader />
      <main id="contenido">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
