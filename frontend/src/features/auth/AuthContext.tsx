import { useEffect, useMemo, useState, type ReactNode } from "react";

import { login as loginRequest, logout as logoutRequest } from "@/features/auth/api";
import { getMyProfile } from "@/features/auth/profileApi";
import { AuthContext, type AuthContextValue, type OrganizationInfo } from "@/features/auth/useAuth";
import { getMyOrganization } from "@/features/organizations/api";
import { tokenStorage } from "@/lib/tokenStorage";
import type { UserProfile } from "@/types/user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(tokenStorage.getAccess()));
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveModules([]);
      setModulesLoaded(false);
      setOrganization(null);
      setProfile(null);
      return;
    }

    let cancelled = false;
    setModulesLoaded(false);
    getMyOrganization()
      .then((organization) => {
        if (cancelled) return;
        setOrganization({
          name: organization.name,
          timezone: organization.timezone,
          currency: organization.default_currency,
        });
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

    getMyProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
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
      organization,
      profile,
      can: (permission: string) => profile?.permissions.includes(permission) ?? false,
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
    [isAuthenticated, modulesLoaded, activeModules, organization, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

