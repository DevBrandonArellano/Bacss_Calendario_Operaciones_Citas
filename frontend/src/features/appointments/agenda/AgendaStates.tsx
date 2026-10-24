import { CalendarX2, Clock, FilterX, Lock, UserSearch } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonStyles } from "@/components/ui/buttonStyles";

interface EmptyPeriodProps {
  rangeLabel: string;
  canCreate: boolean;
  newAppointmentHref: string;
  /** Se ofrece «Ir a hoy» solo si el período mostrado no incluye hoy. */
  showGoToToday: boolean;
  onToday: () => void;
  compact?: boolean;
}

/** No hay citas en el período consultado (y no hay filtros que lo expliquen). */
export function EmptyPeriod({ rangeLabel, canCreate, newAppointmentHref, showGoToToday, onToday, compact }: EmptyPeriodProps) {
  return (
    <EmptyState
      compact={compact}
      icon={CalendarX2}
      title="No hay citas en este período"
      description={`${rangeLabel}. Cuando agendes una cita aparecerá aquí.`}
      actions={
        <>
          {canCreate && (
            <Link to={newAppointmentHref} className={buttonStyles({ variant: "primary", size: "sm" })}>
              Nueva cita
            </Link>
          )}
          {showGoToToday && (
            <Button size="sm" onClick={onToday}>
              Ir a hoy
            </Button>
          )}
        </>
      }
    />
  );
}

/** Hay citas en el período, pero ninguna cumple los filtros activos. */
export function EmptyFiltered({ onClear, compact }: { onClear: () => void; compact?: boolean }) {
  return (
    <EmptyState
      compact={compact}
      icon={FilterX}
      title="Ninguna cita coincide con los filtros"
      description="Prueba con otros filtros o límpialos para ver todas las citas del período."
      actions={
        <Button size="sm" variant="primary" onClick={onClear}>
          Limpiar filtros
        </Button>
      }
    />
  );
}

/** El usuario no tiene permiso para consultar la agenda (403), distinto de «no hay citas». */
export function ForbiddenState() {
  return (
    <EmptyState
      tone="error"
      icon={Lock}
      title="No tienes permiso para ver la agenda"
      description="Pide a un administrador de tu empresa que te habilite el acceso a las citas."
    />
  );
}

/** La vista «Por profesional» necesita saber de quién; sin lista de profesionales no se puede elegir. */
export function PickEmployee({ hasEmployees }: { hasEmployees: boolean }) {
  return (
    <EmptyState
      icon={UserSearch}
      title="Elige un profesional"
      description={
        hasEmployees
          ? "Selecciona un profesional en los filtros para ver su semana y sus huecos libres."
          : "No hay profesionales activos para mostrar. Registra uno en la sección Profesionales."
      }
      actions={
        !hasEmployees ? (
          <Link to="/profesionales" className={buttonStyles({ size: "sm" })}>
            Ir a Profesionales
          </Link>
        ) : undefined
      }
    />
  );
}

/** Aviso (no bloqueante) cuando no hay horarios laborales: sin ellos no hay disponibilidad que calcular. */
export function NoScheduleNotice(): ReactNode {
  return (
    <div role="status" className="mb-4 flex items-start gap-3 rounded-card border border-line bg-status-pending-soft p-4 text-sm text-status-pending-fg">
      <Clock className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="m-0">
        <strong>No hay horarios de trabajo configurados.</strong> Sin horarios laborales el sistema no puede calcular
        horarios disponibles ni agendar nuevas citas. Pide a un administrador que los configure.
      </p>
    </div>
  );
}

export function TruncatedNotice({ shown, total }: { shown: number; total: number }) {
  return (
    <p role="status" className="mb-4 rounded-card border border-line bg-subtle px-4 py-3 text-sm text-muted">
      Se muestran {shown} de {total} citas del período. Acota las fechas o aplica filtros para ver el resto.
    </p>
  );
}
