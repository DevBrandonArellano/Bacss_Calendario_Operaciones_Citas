import { CalendarPlus, ChevronLeft, ChevronRight, Filter, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { AGENDA_VIEWS, AGENDA_VIEW_LABELS, type AgendaView } from "@/features/appointments/agenda/agendaRange";
import { cn } from "@/lib/cn";

interface AgendaHeaderProps {
  view: AgendaView;
  rangeLabel: string;
  canCreate: boolean;
  newAppointmentHref: string;
  filtersOpen: boolean;
  activeFilterCount: number;
  refreshing: boolean;
  isToday: boolean;
  onToday: () => void;
  onStep: (direction: 1 | -1) => void;
  onViewChange: (view: AgendaView) => void;
  onToggleFilters: () => void;
  onRefresh: () => void;
}

const FILTERS_PANEL_ID = "agenda-filtros";
export { FILTERS_PANEL_ID };

/** Título, acción principal y barra de herramientas (navegación de fechas, vista, filtros, actualizar). */
export function AgendaHeader({
  view,
  rangeLabel,
  canCreate,
  newAppointmentHref,
  filtersOpen,
  activeFilterCount,
  refreshing,
  isToday,
  onToday,
  onStep,
  onViewChange,
  onToggleFilters,
  onRefresh,
}: AgendaHeaderProps) {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl font-bold tracking-tight text-ink">Agenda</h1>
          <p className="mt-1 text-muted">Consulta y administra las citas de tu negocio.</p>
        </div>
        {canCreate && (
          <Link to={newAppointmentHref} className={buttonStyles({ variant: "primary" })}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            Nueva cita
          </Link>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onToday} disabled={isToday && view === "day"}>
            Hoy
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" aria-label="Período anterior" onClick={() => onStep(-1)}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Período siguiente" onClick={() => onStep(1)}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
          <p aria-live="polite" className="m-0 min-w-40 text-base font-semibold text-ink">
            {rangeLabel}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Vista del calendario" className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-subtle p-1">
            {AGENDA_VIEWS.map((option) => {
              const selected = option === view;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onViewChange(option)}
                  className={cn(
                    "min-h-8 whitespace-nowrap rounded-lg border-0 px-3 py-1 text-sm font-medium shadow-none transition-colors",
                    selected ? "bg-surface text-ink shadow-card hover:bg-surface" : "bg-transparent text-muted hover:text-ink"
                  )}
                >
                  {AGENDA_VIEW_LABELS[option]}
                </button>
              );
            })}
          </div>

          <Button size="sm" aria-expanded={filtersOpen} aria-controls={FILTERS_PANEL_ID} onClick={onToggleFilters}>
            <Filter className="size-4" aria-hidden="true" />
            Filtros
            {activeFilterCount > 0 && (
              <span
                aria-label={`${activeFilterCount} filtros activos`}
                className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-on-brand"
              >
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="sm" aria-label="Actualizar agenda" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </>
  );
}
