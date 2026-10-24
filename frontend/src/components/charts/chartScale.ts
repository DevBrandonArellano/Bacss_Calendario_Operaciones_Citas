import { addDays, parseISODate, toISODate } from "@/lib/dates";

export interface NiceScale {
  max: number;
  ticks: number[];
}

const STEP_FACTORS = [1, 2, 2.5, 5, 10];
const INTEGER_STEP_FACTORS = [1, 2, 5, 10];
const TARGET_TICKS = 4;

/**
 * Escala con máximo «redondo» y marcas equidistantes (0, 2, 4, 6, 8...).
 * Con `integer` las marcas son siempre enteras (conteos: no existe «1,5 citas»).
 */
export function niceScale(maxValue: number, { integer = false }: { integer?: boolean } = {}): NiceScale {
  const safeMax = maxValue > 0 ? maxValue : 1;
  const rawStep = safeMax / TARGET_TICKS;
  const magnitude = Math.max(integer ? 1 : 0, 10 ** Math.floor(Math.log10(rawStep)));
  const factors = integer ? INTEGER_STEP_FACTORS : STEP_FACTORS;
  const step = (factors.find((factor) => factor * magnitude >= rawStep) ?? 10) * magnitude;
  const max = Math.ceil(safeMax / step) * step;

  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 1000; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return { max: Number(max.toFixed(10)), ticks };
}

export interface DayPoint {
  period: string;
  value: number;
}

/** Serie diaria continua: el backend omite los días sin registros, el gráfico no debería. */
export function fillDays(points: DayPoint[], from: string, to: string): DayPoint[] {
  const byDay = new Map(points.map((point) => [point.period, point.value]));
  const filled: DayPoint[] = [];
  const end = parseISODate(to);
  for (let day = parseISODate(from); day <= end; day = addDays(day, 1)) {
    const key = toISODate(day);
    filled.push({ period: key, value: byDay.get(key) ?? 0 });
  }
  return filled;
}
