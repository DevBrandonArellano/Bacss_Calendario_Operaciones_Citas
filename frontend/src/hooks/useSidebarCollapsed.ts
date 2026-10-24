import { useCallback, useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // localStorage inaccesible (modo privado, política del navegador): se queda expandida.
    return false;
  }
}

/** Estado de la barra lateral en escritorio, persistido como preferencia por navegador. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(readStored);

  const toggle = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Sin persistencia: el cambio sigue aplicando en esta sesión.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
