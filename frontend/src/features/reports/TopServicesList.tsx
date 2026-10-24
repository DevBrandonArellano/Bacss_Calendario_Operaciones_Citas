import type { TopService } from "@/features/reports/dashboardData";
import { pluralize } from "@/lib/format";

/** Servicios por demanda, de mayor a menor, con porcentaje sobre el total del período. */
export function TopServicesList({ services }: { services: TopService[] }) {
  const max = Math.max(1, ...services.map((service) => service.count));

  return (
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      {services.map((service) => (
        <li key={service.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink">{service.name}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {pluralize(service.count, "cita", "citas")} · <span className="font-semibold text-ink">{service.percent}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max((service.count / max) * 100, 3)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
