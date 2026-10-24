import { createContext, useContext } from "react";

import type { UserProfile } from "@/types/user";

export interface OrganizationInfo {
  name: string;
  timezone: string;
  currency: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  /** Módulos especializados activos para la organización del usuario
   * (docs/module-system.md). `false` mientras se resuelven, para que las
   * pantallas guardadas por módulo no redirijan antes de tiempo. */
  modulesLoaded: boolean;
  activeModules: string[];
  hasModule: (moduleCode: string) => boolean;
  /** Datos de la empresa en sesión que la UI necesita para formatear (zona horaria, moneda). */
  organization: OrganizationInfo | null;
  /** Perfil del usuario en sesión; `null` mientras carga o si no pudo obtenerse. */
  profile: UserProfile | null;
  /** ¿El usuario tiene este permiso? Solo para mostrar/ocultar acciones (el backend autoriza). */
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/** Vive fuera de `AuthContext.tsx` para que ese archivo solo exporte
 * componentes y Fast Refresh siga funcionando (react-refresh/only-export-components). */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return context;
}
