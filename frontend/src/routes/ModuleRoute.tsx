import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/features/auth/useAuth";

/** Bloquea una ruta de módulo especializado si no está activo para la
 * organización del usuario (docs/module-system.md). Defensa en el
 * frontend: el backend ya responde 404 en la API para el mismo caso, esto
 * solo evita mostrar una pantalla que va a fallar todas sus llamadas. */
export function ModuleRoute({ moduleCode, children }: { moduleCode: string; children: ReactNode }) {
  const { hasModule, modulesLoaded } = useAuth();

  if (!modulesLoaded) return <p>Cargando...</p>;
  if (!hasModule(moduleCode)) return <Navigate to="/citas" replace />;

  return <>{children}</>;
}
