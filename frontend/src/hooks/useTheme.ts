import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme-preference";
const THEME_VALUES: readonly ThemePreference[] = ["light", "dark", "system"];

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && (THEME_VALUES as readonly string[]).includes(value);
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    // localStorage inaccesible (modo privado, política del navegador, etc.):
    // se cae de vuelta a la preferencia del sistema en vez de romper la app.
    return "system";
  }
}

function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  // "system" no fija el atributo: deja que el CSS bajo prefers-color-scheme
  // (docs/CLAUDE.md: "modo claro/oscuro con override manual persistido")
  // siga decidiendo, en vez de congelar el tema que tenía el sistema al montar.
  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }
}

export interface UseThemeResult {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

/** Override manual persistido del tema claro/oscuro/sistema (CLAUDE.md: UX). */
export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredPreference());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin persistencia disponible: el tema igual se aplica para esta sesión.
    }
  }, []);

  return { theme, setTheme };
}
