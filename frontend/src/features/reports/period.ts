import { addDays, parseISODate, toISODate } from "@/lib/dates";

export type DashboardPeriod = "today" | "7d" | "30d" | "month";

export const DASHBOARD_PERIODS: DashboardPeriod[] = ["today", "7d", "30d", "month"];

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: "Hoy",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  month: "Este mes",
};

export interface PeriodRange {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Rango del período seleccionado (hasta `today`, fecha local del negocio) y el rango anterior
 * de igual duración, para comparar peras con peras.
 */
export function periodRange(period: DashboardPeriod, today: string): PeriodRange {
  const end = parseISODate(today);

  if (period === "month") {
    const from = new Date(end.getFullYear(), end.getMonth(), 1);
    const previousFrom = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    const previousDay = Math.min(end.getDate(), lastDayOfMonth(previousFrom.getFullYear(), previousFrom.getMonth()));
    const previousTo = new Date(previousFrom.getFullYear(), previousFrom.getMonth(), previousDay);
    return { from: toISODate(from), to: today, previousFrom: toISODate(previousFrom), previousTo: toISODate(previousTo) };
  }

  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const from = addDays(end, -(days - 1));
  return {
    from: toISODate(from),
    to: today,
    previousFrom: toISODate(addDays(from, -days)),
    previousTo: toISODate(addDays(from, -1)),
  };
}

export interface SeriesPoint {
  period: string;
  value: number;
}

export function sumSeries(points: SeriesPoint[]): number {
  return points.reduce((total, point) => total + point.value, 0);
}

/** Separa una serie diaria (descargada de una sola vez) en período actual y anterior. */
export function splitByRange(
  points: SeriesPoint[],
  range: PeriodRange
): { current: SeriesPoint[]; previous: SeriesPoint[] } {
  return {
    current: points.filter((p) => p.period >= range.from && p.period <= range.to),
    previous: points.filter((p) => p.period >= range.previousFrom && p.period <= range.previousTo),
  };
}
