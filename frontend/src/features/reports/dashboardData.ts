import { fillDays, type DayPoint } from "@/components/charts/chartScale";
import { listAppointments } from "@/features/appointments/api";
import { ACTIVE_STATUSES } from "@/features/appointments/status";
import { getChartData } from "@/features/reports/api";
import { periodRange, splitByRange, sumSeries, type PeriodRange, type SeriesPoint } from "@/features/reports/period";
import { minutesOfDay } from "@/features/appointments/agenda/timeGrid";
import type { Appointment } from "@/types/appointment";
import type { ChartMetric, ChartPoint } from "@/types/report";

const UPCOMING_LIMIT = 6;
const MIN_CHART_DAYS_PERIOD = "7d" as const;

export interface Trend {
  /** Serie diaria continua del rango del gráfico. */
  series: DayPoint[];
  /** Total del período seleccionado (no del rango del gráfico). */
  total: number;
  /** Total del período anterior de igual duración, para la variación. */
  previousTotal: number;
}

export interface TopService {
  id: string;
  name: string;
  count: number;
  /** Porcentaje sobre el total de citas del período. */
  percent: number;
}

/** Con «Hoy» un gráfico de un solo punto no dice nada: el gráfico muestra al menos los últimos 7 días. */
export function chartRangeFor(range: PeriodRange, today: string): PeriodRange {
  return range.from === range.to ? periodRange(MIN_CHART_DAYS_PERIOD, today) : range;
}

async function loadTrend(
  metric: Extract<ChartMetric, "appointments" | "revenue" | "new_customers">,
  statRange: PeriodRange,
  chartRange: PeriodRange,
  pick: (point: ChartPoint) => number
): Promise<Trend> {
  // Una sola petición cubre el período anterior, el actual y el rango del gráfico.
  const dateFrom = [statRange.previousFrom, chartRange.from].sort()[0];
  const response = await getChartData(metric, "day", dateFrom, statRange.to);
  const points: SeriesPoint[] = response.data.map((point) => ({ period: point.period ?? "", value: pick(point) }));

  const { current, previous } = splitByRange(points, statRange);
  const inChart = points.filter((p) => p.period >= chartRange.from && p.period <= chartRange.to);
  return {
    series: fillDays(inChart, chartRange.from, chartRange.to),
    total: sumSeries(current),
    previousTotal: sumSeries(previous),
  };
}

export const loadAppointmentsTrend = (statRange: PeriodRange, chartRange: PeriodRange) =>
  loadTrend("appointments", statRange, chartRange, (point) => point.count ?? 0);

export const loadRevenueTrend = (statRange: PeriodRange, chartRange: PeriodRange) =>
  loadTrend("revenue", statRange, chartRange, (point) => Number(point.total ?? 0));

export const loadNewCustomersTrend = (statRange: PeriodRange, chartRange: PeriodRange) =>
  loadTrend("new_customers", statRange, chartRange, (point) => point.count ?? 0);

export async function loadTopServices(range: PeriodRange): Promise<TopService[]> {
  const response = await getChartData("top_services", "day", range.from, range.to);
  const total = response.data.reduce((sum, point) => sum + (point.count ?? 0), 0);
  return response.data.map((point) => ({
    id: point.service_id ?? point.service_name ?? "",
    name: point.service_name ?? "",
    count: point.count ?? 0,
    percent: total > 0 ? Math.round(((point.count ?? 0) / total) * 100) : 0,
  }));
}

/** Próximas citas activas desde ahora (en la hora local del negocio), ya ordenadas por el backend. */
export async function loadUpcomingAppointments(today: string, nowMinutes: number): Promise<Appointment[]> {
  const page = await listAppointments({
    appointment_date__gte: today,
    status__in: ACTIVE_STATUSES.join(","),
    page_size: 30,
  });
  return page.results
    .filter((a) => a.appointment_date > today || minutesOfDay(a.end_time) > nowMinutes)
    .slice(0, UPCOMING_LIMIT);
}
