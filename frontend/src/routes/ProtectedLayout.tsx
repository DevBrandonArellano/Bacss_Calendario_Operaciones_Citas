import { Outlet } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

/** Ruta de layout: aplica sesión + chrome de la app una sola vez a todas las
 * rutas internas, en vez de repetir `<ProtectedRoute><AppLayout>` por ruta. */
export function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}
