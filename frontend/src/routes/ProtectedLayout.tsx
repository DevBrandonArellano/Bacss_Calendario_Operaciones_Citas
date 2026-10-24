import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { pageTitleFor } from "@/components/navigation";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { PRIVATE_PAGE } from "@/seo/pages";
import { usePageMeta } from "@/seo/usePageMeta";

/** Ruta de layout: aplica sesión + chrome de la app una sola vez a todas las
 * rutas internas, en vez de repetir `<ProtectedRoute><AppLayout>` por ruta. */
export function ProtectedLayout() {
  const { pathname } = useLocation();
  // Título de documento por pantalla (accesibilidad); sigue siendo `noindex` y sin datos de la empresa.
  const page = useMemo(() => ({ ...PRIVATE_PAGE, title: `${pageTitleFor(pathname)} | Bacss Citas` }), [pathname]);
  usePageMeta(page);

  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}
