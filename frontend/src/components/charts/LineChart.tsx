import type { ChartDatum } from "@/components/charts/BarChart";
import { niceScale } from "@/components/charts/chartScale";
import { useChartCursor } from "@/components/charts/useChartCursor";
import { cn } from "@/lib/cn";

interface LineChartProps {
  data: ChartDatum[];
  ariaLabel: string;
  formatTick?: (value: number) => string;
  className?: string;
}

const MAX_X_LABELS = 7;

/** Posición horizontal (0-100) de cada punto: centrado en su «columna», como en las barras. */
function xOf(index: number, count: number): number {
  return ((index + 0.5) / count) * 100;
}

/**
 * Evolución en el tiempo: línea y área en SVG (se estira con el contenedor) y puntos como botones
 * HTML encima, para que no se deformen y sean enfocables con teclado.
 */
export function LineChart({ data, ariaLabel, formatTick = String, className }: LineChartProps) {
  const { active, itemProps } = useChartCursor(data.length);
  const scale = niceScale(Math.max(0, ...data.map((d) => d.value)));
  const labelEvery = Math.max(1, Math.ceil(data.length / MAX_X_LABELS));

  const points = data.map((datum, index) => ({
    x: xOf(index, data.length),
    y: 100 - (datum.value / scale.max) * 100,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = points.length > 0 ? `${linePath} L${points[points.length - 1].x},100 L${points[0].x},100 Z` : "";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex h-56 gap-3 pt-3">
        <div className="relative w-14 shrink-0 text-right text-xs text-muted tabular-nums" aria-hidden="true">
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

          <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={areaPath} className="fill-brand/15" />
            <path
              d={linePath}
              fill="none"
              className="stroke-brand"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {data.map((datum, index) => (
            <div
              key={datum.label}
              className="absolute"
              style={{ left: `${points[index].x}%`, top: `${points[index].y}%` }}
            >
              <button
                type="button"
                aria-label={datum.description}
                className={cn(
                  "absolute -left-2.5 -top-2.5 size-5 min-h-0 rounded-full border-2 border-brand bg-surface p-0 shadow-none transition-transform",
                  active === index && "scale-125 bg-brand"
                )}
                {...itemProps(index)}
              />
              {active === index && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-page shadow-float"
                  style={{ top: "-0.9rem" }}
                >
                  {datum.description}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3" aria-hidden="true">
        <span className="w-14 shrink-0" />
        <div className="flex flex-1">
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
