import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import { ModuleRoute } from "@/routes/ModuleRoute";

/** Ruta de layout para un módulo especializado: verifica que esté activo y
 * envuelve el `Suspense` que necesitan sus pantallas, cargadas con `lazy()`
 * para que el bundle base no incluya módulos que la organización no usa
 * (docs/module-system.md). */
export function ModuleLayout({ moduleCode }: { moduleCode: string }) {
  return (
    <ModuleRoute moduleCode={moduleCode}>
      <Suspense fallback={<p>Cargando...</p>}>
        <Outlet />
      </Suspense>
    </ModuleRoute>
  );
}
