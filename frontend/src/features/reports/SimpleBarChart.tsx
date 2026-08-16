export interface BarChartDatum {
  label: string;
  value: number;
  displayValue?: string;
}

interface SimpleBarChartProps {
  title: string;
  data: BarChartDatum[];
  emptyMessage?: string;
}

/**
 * Barras horizontales en HTML/CSS plano (sin librería de gráficos):
 * una sola serie por gráfico, así que el color no codifica identidad,
 * solo la posición/longitud codifica la magnitud — un único color de
 * acento basta (docs/dataviz: "Sequential = one hue"). Etiqueta directa
 * en cada barra porque la lista es corta (≤ ~15 puntos), no un número
 * en cada punto de una serie densa.
 */
export function SimpleBarChart({ title, data, emptyMessage = "Sin datos en este rango." }: SimpleBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <h3>{title}</h3>
      {data.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        <div className="bar-chart">
          {data.map((point) => (
            <div className="bar-chart-row" key={point.label}>
              <span className="bar-chart-label">{point.label}</span>
              <span className="bar-chart-track">
                <span
                  className="bar-chart-fill"
                  style={{ width: `${Math.max(2, (point.value / max) * 100)}%` }}
                />
              </span>
              <span className="bar-chart-value">{point.displayValue ?? point.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
