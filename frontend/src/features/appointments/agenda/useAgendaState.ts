import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { AgendaView } from "@/features/appointments/agenda/agendaRange";
import { parseAgendaParams, toSearchParams, type AgendaState } from "@/features/appointments/agenda/agendaUrl";

const NARROW_VIEWPORT_QUERY = "(max-width: 767px)";

/** En móvil la vista diaria es la más útil; en escritorio, la semanal. */
function preferredViewForDevice(): AgendaView {
  return typeof window !== "undefined" && window.matchMedia?.(NARROW_VIEWPORT_QUERY).matches ? "day" : "week";
}

/**
 * Estado de la Agenda (vista, fecha, filtros, cita abierta) guardado en la URL: se puede compartir,
 * recuperar al recargar y recorrer con los botones Atrás/Adelante del navegador.
 */
export function useAgendaState(today: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultView = useMemo(preferredViewForDevice, []);
  const state = useMemo(() => parseAgendaParams(searchParams, today, defaultView), [searchParams, today, defaultView]);

  const update = useCallback(
    (patch: Partial<AgendaState>, options?: { replace?: boolean }) => {
      setSearchParams(toSearchParams({ ...state, ...patch }), options);
    },
    [state, setSearchParams]
  );

  return { state, update };
}
