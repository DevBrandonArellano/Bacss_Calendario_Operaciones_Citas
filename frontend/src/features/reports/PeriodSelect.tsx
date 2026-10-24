import { DASHBOARD_PERIODS, PERIOD_LABELS, type DashboardPeriod } from "@/features/reports/period";
import { cn } from "@/lib/cn";

interface PeriodSelectProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

/** Control segmentado de período (botones con `aria-pressed`, navegables con Tab). */
export function PeriodSelect({ value, onChange }: PeriodSelectProps) {
  return (
    <div role="group" aria-label="Período" className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
      {DASHBOARD_PERIODS.map((period) => {
        const selected = period === value;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(period)}
            className={cn(
              "min-h-8 rounded-lg border-0 px-3 py-1 text-sm font-medium shadow-none transition-colors",
              selected ? "bg-brand text-on-brand hover:bg-brand-hover" : "bg-transparent text-muted hover:bg-subtle hover:text-ink"
            )}
          >
            {PERIOD_LABELS[period]}
          </button>
        );
      })}
    </div>
  );
}
