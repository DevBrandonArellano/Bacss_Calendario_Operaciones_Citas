import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { countUnreadNotifications } from "@/features/notifications/api";

/**
 * Notificaciones sin leer del usuario. Se consulta al montar y al cambiar de pantalla (no hay
 * polling continuo); `null` significa «desconocido» (error o sin permiso), no «cero».
 */
export function useUnreadNotifications(): number | null {
  const { pathname } = useLocation();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    countUnreadNotifications()
      .then((value) => {
        if (!cancelled) setCount(value);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return count;
}
