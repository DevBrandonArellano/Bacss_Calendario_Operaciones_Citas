import { APPOINTMENT_STATUS_STYLE } from "@/features/appointments/status";
import { groupByDate, monthMatrix } from "@/features/appointments/agenda/grouping";
import type { AgendaViewProps } from "@/features/appointments/agenda/viewTypes";
import { cn } from "@/lib/cn";
import { toISODate } from "@/lib/dates";
import { pluralize } from "@/lib/format";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_CHIPS = 2;

/** Intensidad de ocupación (0-3) para el fondo de la celda; sin números mágicos repartidos. */
function loadLevel(count: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 7) return 2;
  return 3;
}

const LEVEL_BACKGROUND = ["", "bg-brand-soft/40", "bg-brand-soft/70", "bg-brand-soft"] as const;

/**
 * Cuadrícula del mes: en cada día, cuántas citas hay y un resumen de las primeras. El detalle
 * completo se ve al abrir el día (no se intenta meter todo en una celda pequeña).
 */
export function MonthView({ date, appointments, now, onOpenDay }: AgendaViewProps) {
  const weeks = monthMatrix(date);
  const byDate = groupByDate(appointments);

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <div className="min-w-[44rem]">
        <div className="grid grid-cols-7 border-b border-line bg-subtle">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
              {weekday}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={toISODate(week[0])} className="grid grid-cols-7">
            {week.map((day) => {
              const iso = toISODate(day);
              const items = byDate.get(iso) ?? [];
              const inMonth = day.getMonth() === date.getMonth();
              const isToday = iso === now.date;
              const label = `${day.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}, ${
                items.length > 0 ? pluralize(items.length, "cita", "citas") : "sin citas"
              }`;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onOpenDay(iso)}
                  aria-label={label}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "flex min-h-28 min-w-0 flex-col items-stretch gap-1 rounded-none border-0 border-b border-r border-line p-2 text-left shadow-none",
                    "hover:bg-subtle",
                    inMonth ? LEVEL_BACKGROUND[loadLevel(items.length)] : "bg-subtle"
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums",
                        isToday ? "bg-brand text-on-brand" : inMonth ? "text-ink" : "text-muted"
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {items.length > 0 && <span className="text-xs font-semibold text-muted">{items.length}</span>}
                  </span>
                  {items.slice(0, MAX_CHIPS).map((appointment) => (
                    <span
                      key={appointment.id}
                      className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ink"
                      aria-hidden="true"
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", APPOINTMENT_STATUS_STYLE[appointment.status].dot)} />
                      <span className="truncate">
                        {appointment.start_time.slice(0, 5)} {appointment.customer_name}
                      </span>
                    </span>
                  ))}
                  {items.length > MAX_CHIPS && (
                    <span className="text-xs font-medium text-brand" aria-hidden="true">
                      +{items.length - MAX_CHIPS} más
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
