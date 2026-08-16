import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { login as loginRequest, logout as logoutRequest } from "@/features/auth/api";
import { getMyOrganization } from "@/features/organizations/api";
import { tokenStorage } from "@/lib/tokenStorage";

interface AuthContextValue {
  isAuthenticated: boolean;
  /** Módulos especializados activos para la organización del usuario
   * (docs/module-system.md). `false` mientras se resuelven, para que las
   * pantallas guardadas por módulo no redirijan antes de tiempo. */
  modulesLoaded: boolean;
  activeModules: string[];
  hasModule: (moduleCode: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(tokenStorage.getAccess()));
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [modulesLoaded, setModulesLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveModules([]);
      setModulesLoaded(false);
      return;
    }

    let cancelled = false;
    setModulesLoaded(false);
    getMyOrganization()
      .then((organization) => {
        if (cancelled) return;
        setActiveModules(
          organization.modules.filter((module) => module.is_active).map((module) => module.module_code)
        );
      })
      .catch(() => {
        if (!cancelled) setActiveModules([]);
      })
      .finally(() => {
        if (!cancelled) setModulesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      modulesLoaded,
      activeModules,
      hasModule: (moduleCode: string) => activeModules.includes(moduleCode),
      login: async (email, password) => {
        const tokens = await loginRequest({ email, password });
        tokenStorage.set(tokens.access, tokens.refresh);
        setIsAuthenticated(true);
      },
      logout: async () => {
        const refresh = tokenStorage.getRefresh();
        if (refresh) {
          try {
            await logoutRequest(refresh);
          } catch {
            // Si el refresh ya expiró no importa: igual limpiamos la sesión local.
          }
        }
        tokenStorage.clear();
        setIsAuthenticated(false);
      },
    }),
    [isAuthenticated, modulesLoaded, activeModules]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return context;
}
