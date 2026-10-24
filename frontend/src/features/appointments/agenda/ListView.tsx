import { AppointmentStatusBadge } from "@/features/appointments/AppointmentStatusBadge";
import { groupByDate } from "@/features/appointments/agenda/grouping";
import type { AgendaViewProps } from "@/features/appointments/agenda/viewTypes";
import { cn } from "@/lib/cn";
import { parseISODate } from "@/lib/dates";

function dayHeading(iso: string): string {
  const label = parseISODate(iso).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Citas de los próximos 30 días agrupadas por día; cada fila abre el panel de detalle. */
export function ListView({ appointments, now, selectedId, onSelect }: AgendaViewProps) {
  const groups = [...groupByDate(appointments).entries()];

  return (
    <div className="flex flex-col gap-6">
      {groups.map(([iso, items]) => (
        <section key={iso} aria-labelledby={`dia-${iso}`}>
          <h2 id={`dia-${iso}`} className="m-0 mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            {dayHeading(iso)}
            {iso === now.date && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Hoy</span>}
          </h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface p-0 shadow-card">
            {items.map((appointment) => (
              <li key={appointment.id}>
                <button
                  type="button"
                  onClick={() => onSelect(appointment)}
                  className={cn(
                    "flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-none border-0 bg-transparent px-4 py-3 text-left shadow-none hover:bg-subtle",
                    appointment.id === selectedId && "bg-brand-soft"
                  )}
                >
                  <span className="w-24 shrink-0 text-sm font-bold tabular-nums text-ink">
                    {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{appointment.customer_name}</span>
                    <span className="block truncate text-xs text-muted">
                      {appointment.service_name} · {appointment.employee_name}
                    </span>
                  </span>
                  <AppointmentStatusBadge status={appointment.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
