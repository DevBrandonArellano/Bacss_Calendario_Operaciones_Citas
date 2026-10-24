import { niceScale } from "@/components/charts/chartScale";
import { useChartCursor } from "@/components/charts/useChartCursor";
import { cn } from "@/lib/cn";

export interface ChartDatum {
  /** Etiqueta corta del eje X (p. ej. «24 oct»). */
  label: string;
  value: number;
  /** Texto completo para tooltip y lectores de pantalla (p. ej. «24 oct: 5 citas»). */
  description: string;
}

interface BarChartProps {
  data: ChartDatum[];
  ariaLabel: string;
  formatTick?: (value: number) => string;
  /** Marcas del eje Y enteras (por defecto sí: el gráfico de barras representa conteos). */
  integerTicks?: boolean;
  className?: string;
}

const MAX_X_LABELS = 7;

/**
 * Gráfico de barras verticales en HTML/CSS (sin librería). Cada barra es enfocable (flechas para
 * recorrerlas) y trae su descripción completa como nombre accesible; el tooltip es solo visual.
 */
export function BarChart({ data, ariaLabel, formatTick = String, integerTicks = true, className }: BarChartProps) {
  const { active, itemProps } = useChartCursor(data.length);
  const scale = niceScale(Math.max(0, ...data.map((d) => d.value)), { integer: integerTicks });
  const labelEvery = Math.max(1, Math.ceil(data.length / MAX_X_LABELS));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex h-56 gap-3 pt-3">
        <div className="relative w-9 shrink-0 text-right text-xs text-muted tabular-nums" aria-hidden="true">
          {scale.ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(tick / scale.max) * 100}%` }}>
              {formatTick(tick)}
            </span>
          ))}
        </div>

        <div role="group" aria-label={ariaLabel} className="relative flex-1">
          {scale.ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden="true"
              className={cn("absolute inset-x-0 border-t", tick === 0 ? "border-line" : "border-dashed border-line/70")}
              style={{ bottom: `${(tick / scale.max) * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-1">
            {data.map((datum, index) => (
              <div key={datum.label} className="relative flex h-full flex-1 items-end justify-center">
                <button
                  type="button"
                  aria-label={datum.description}
                  className={cn(
                    "w-full max-w-10 rounded-t-md border-0 p-0 shadow-none transition-colors",
                    "min-h-0 bg-brand hover:bg-brand-hover focus-visible:bg-brand-hover",
                    datum.value === 0 && "bg-line hover:bg-line"
                  )}
                  style={{ height: `${Math.max((datum.value / scale.max) * 100, datum.value > 0 ? 2 : 0.8)}%` }}
                  {...itemProps(index)}
                />
                {active === index && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute z-10 -translate-y-1.5 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-page shadow-float"
                    style={{ bottom: `${(datum.value / scale.max) * 100}%` }}
                  >
                    {datum.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3" aria-hidden="true">
        <span className="w-9 shrink-0" />
        <div className="flex flex-1 gap-1">
          {data.map((datum, index) => (
            <span key={datum.label} className="flex-1 text-center text-xs text-muted">
              {index % labelEvery === 0 ? datum.label : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
