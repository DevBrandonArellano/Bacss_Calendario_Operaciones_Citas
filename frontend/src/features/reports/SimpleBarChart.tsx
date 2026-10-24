import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";

export interface BarChartDatum {
  label: string;
  value: number;
  displayValue?: string;
}

interface SimpleBarChartProps {
  title: string;
  data: BarChartDatum[];
  emptyMessage?: string;
  className?: string;
}

/**
 * Barras horizontales en HTML/CSS plano (sin librería de gráficos):
 * una sola serie por gráfico, así que el color no codifica identidad,
 * solo la longitud codifica la magnitud — un único color de acento
 * basta (docs/dataviz: "Sequential = one hue"). Etiqueta directa en
 * cada barra porque la lista es corta (≤ ~15 puntos).
 */
export function SimpleBarChart({ title, data, emptyMessage = "Sin datos en este rango.", className }: SimpleBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <Card className={cn("h-full", className)}>
      <h2 className="m-0 mb-5 text-base font-semibold text-ink">{title}</h2>
      {data.length === 0 ? (
        <p className="m-0 rounded-xl bg-subtle px-4 py-6 text-center text-sm text-muted">{emptyMessage}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {data.map((point) => (
            <li key={point.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-right text-xs text-muted" title={point.label}>
                {point.label}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-subtle">
                <span
                  className="block h-full rounded-full bg-brand transition-[width] duration-500"
                  style={{ width: `${Math.max(2, (point.value / max) * 100)}%` }}
                />
              </span>
              <span className="w-14 shrink-0 text-sm font-semibold text-ink tabular-nums">
                {point.displayValue ?? point.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
