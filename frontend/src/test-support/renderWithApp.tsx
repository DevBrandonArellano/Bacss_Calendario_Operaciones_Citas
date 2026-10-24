import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "@/features/auth/useAuth";

interface RenderOptions {
  route?: string;
  /** Permisos que `can()` debe conceder. */
  permissions?: string[];
  timezone?: string;
  currency?: string;
  activeModules?: string[];
}

/** Renderiza una pantalla con router y sesión simulados (sin red ni AuthProvider real). */
export function renderWithApp(ui: ReactElement, options: RenderOptions = {}) {
  const { route = "/", permissions = [], timezone = "America/Guayaquil", currency = "USD", activeModules = [] } = options;
  const granted = new Set(permissions);

  const auth: AuthContextValue = {
    isAuthenticated: true,
    modulesLoaded: true,
    activeModules,
    hasModule: (code) => activeModules.includes(code),
    organization: { name: "Motors Ecuador", timezone, currency },
    profile: null,
    can: (permission) => granted.has(permission),
    login: async () => undefined,
    logout: async () => undefined,
  };

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}
