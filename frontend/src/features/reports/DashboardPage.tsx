import {
  Banknote,
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  CheckCheck,
  ListChecks,
  type LucideIcon,
  UserPlus,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Delta } from "@/components/ui/Delta";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResourceView } from "@/components/ui/ResourceView";
import { StatCard } from "@/components/ui/StatCard";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { agendaLink } from "@/features/appointments/agenda/agendaUrl";
import { useAuth } from "@/features/auth/useAuth";
import { getDashboard } from "@/features/reports/api";
import { ChartCard } from "@/features/reports/ChartCard";
import {
  chartRangeFor,
  loadAppointmentsTrend,
  loadNewCustomersTrend,
  loadRevenueTrend,
  loadTopServices,
  loadUpcomingAppointments,
  type Trend,
} from "@/features/reports/dashboardData";
import { DASHBOARD_PERIODS, PERIOD_LABELS, periodRange, type DashboardPeriod } from "@/features/reports/period";
import { PeriodSelect } from "@/features/reports/PeriodSelect";
import { QuickActions } from "@/features/reports/QuickActions";
import { TopServicesList } from "@/features/reports/TopServicesList";
import { UpcomingAppointments } from "@/features/reports/UpcomingAppointments";
import { useAsyncResource, type AsyncState } from "@/hooks/useAsyncResource";
import { useBusinessNow } from "@/hooks/useBusinessNow";
import { formatDayMonth } from "@/lib/dates";
import { formatCurrency, formatCurrencyCompact, formatPercentChange, pluralize } from "@/lib/format";
import type { AppointmentStatus } from "@/types/appointment";

const DEFAULT_PERIOD: DashboardPeriod = "7d";
const COMPARED_TO = "vs. período anterior";

function parsePeriod(value: string | null): DashboardPeriod {
  return DASHBOARD_PERIODS.includes(value as DashboardPeriod) ? (value as DashboardPeriod) : DEFAULT_PERIOD;
}

function trendDetail(trend: Trend) {
  const change = formatPercentChange(trend.total, trend.previousTotal);
  return change ? (
    <Delta change={change} comparedTo={COMPARED_TO} />
  ) : (
    <span className="text-xs">Sin datos del período anterior para comparar.</span>
  );
}

const BREAKDOWN_LABELS: [AppointmentStatus, string][] = [
  ["pending", "pendientes"],
  ["confirmed", "confirmadas"],
  ["in_progress", "en proceso"],
  ["completed", "completadas"],
];

function breakdownText(byStatus: Record<string, number>): string {
  const parts = BREAKDOWN_LABELS.filter(([status]) => (byStatus[status] ?? 0) > 0).map(
    ([status, label]) => `${byStatus[status]} ${label}`
  );
  return parts.length > 0 ? parts.join(" · ") : "Sin citas programadas hoy";
}

export function DashboardPage() {
  const { organization, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parsePeriod(searchParams.get("periodo"));
  const now = useBusinessNow(organization?.timezone);
  const today = now.date;
  const currency = organization?.currency ?? "USD";

  const range = useMemo(() => periodRange(period, today), [period, today]);
  const chartRange = useMemo(() => chartRangeFor(range, today), [range, today]);

  const loadSummary = useCallback(() => getDashboard(), []);
  const [summary, reloadSummary] = useAsyncResource(loadSummary);

  // El backend decide qué cifras son visibles: si devolvió ingresos, el usuario tiene permiso financiero.
  const financial = summary.status === "ready" && summary.data.revenue_this_month !== undefined;

  const loadAppointments = useCallback(() => loadAppointmentsTrend(range, chartRange), [range, chartRange]);
  const loadServices = useCallback(() => loadTopServices(range), [range]);
  const loadRevenue = useCallback(() => loadRevenueTrend(range, chartRange), [range, chartRange]);
  const loadCustomers = useCallback(() => loadNewCustomersTrend(range, chartRange), [range, chartRange]);
  const loadUpcoming = useCallback(() => loadUpcomingAppointments(today, now.minutes), [today, now.minutes]);

  const [appointments, reloadAppointments] = useAsyncResource(loadAppointments);
  const [services, reloadServices] = useAsyncResource(loadServices);
  const [revenue, reloadRevenue] = useAsyncResource(loadRevenue, financial);
  const [customers] = useAsyncResource(loadCustomers, financial);
  const [upcoming, reloadUpcoming] = useAsyncResource(loadUpcoming);

  function changePeriod(next: DashboardPeriod) {
    setSearchParams(next === DEFAULT_PERIOD ? {} : { periodo: next }, { replace: true });
  }

  const canCreate = can("appointments:write");
  const periodLabel = PERIOD_LABELS[period].toLowerCase();
  const chartSubtitle = `${formatDayMonth(chartRange.from)} – ${formatDayMonth(chartRange.to)}`;
  const createAppointmentAction = canCreate ? (
    <Link to="/citas/nueva" className={buttonStyles({ variant: "primary", size: "sm" })}>
      <CalendarPlus className="size-4" aria-hidden="true" />
      Crear cita
    </Link>
  ) : null;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen de la actividad y el rendimiento de tu negocio."
        actions={
          <>
            <PeriodSelect value={period} onChange={changePeriod} />
            {canCreate && (
              <Link to="/citas/nueva" className={buttonStyles({ variant: "primary" })}>
                <CalendarPlus className="size-4" aria-hidden="true" />
                Crear cita
              </Link>
            )}
          </>
        }
      />

      <ResourceView
        state={summary}
        errorTitle="No se pudo cargar el resumen"
        onRetry={reloadSummary}
        skeletonClassName="h-40"
      >
        {(data) => (
          <section aria-label="Indicadores" className="grid grid-cols-12 gap-6">
            <StatCard
              className="col-span-12 sm:col-span-6 xl:col-span-3"
              label="Citas de hoy"
              value={data.today_total}
              icon={CalendarCheck}
              detail={breakdownText(data.today_by_status)}
              footer={
                <Link to={agendaLink({ view: "day", date: today })} className="font-medium">
                  Ver agenda de hoy
                </Link>
              }
            />
            <StatCard
              className="col-span-12 sm:col-span-6 xl:col-span-3"
              label="Próximos 7 días"
              value={data.upcoming_7_days}
              icon={CalendarClock}
              detail={
                <ResourceView state={upcoming} errorTitle="" onRetry={reloadUpcoming} skeletonClassName="h-9">
                  {(items) =>
                    items[0] ? (
                      <span>
                        Próxima: <strong className="font-semibold text-ink">{items[0].customer_name}</strong> ·{" "}
                        {items[0].appointment_date === today ? "hoy" : formatDayMonth(items[0].appointment_date)}{" "}
                        {items[0].start_time.slice(0, 5)}
                      </span>
                    ) : (
                      "Sin citas próximas. Cuenta desde mañana (pendientes y confirmadas)."
                    )
                  }
                </ResourceView>
              }
              footer={
                <Link to={agendaLink({ view: "week", date: today })} className="font-medium">
                  Abrir la semana
                </Link>
              }
            />

            {financial ? (
              <>
                <ResourceStat
                  state={customers}
                  label="Clientes nuevos"
                  icon={UserPlus}
                  format={(trend) => String(trend.total)}
                  linkTo="/clientes"
                  linkLabel="Ver clientes"
                  periodLabel={periodLabel}
                />
                <ResourceStat
                  state={revenue}
                  label="Ingresos cobrados"
                  icon={Banknote}
                  format={(trend) => formatCurrency(trend.total, currency)}
                  linkTo="/pagos"
                  linkLabel="Ver pagos"
                  periodLabel={periodLabel}
                />
              </>
            ) : (
              <>
                <ResourceStat
                  state={appointments}
                  label="Citas del período"
                  icon={ListChecks}
                  format={(trend) => String(trend.total)}
                  linkTo={agendaLink({ view: "week", date: today })}
                  linkLabel="Ver agenda"
                  periodLabel={periodLabel}
                />
                <StatCard
                  className="col-span-12 sm:col-span-6 xl:col-span-3"
                  label="Completadas hoy"
                  value={data.today_by_status.completed ?? 0}
                  icon={CheckCheck}
                  detail={`de ${pluralize(data.today_total, "cita", "citas")} de hoy`}
                  footer={
                    <Link to={agendaLink({ view: "day", date: today })} className="font-medium">
                      Ver el día
                    </Link>
                  }
                />
              </>
            )}
          </section>
        )}
      </ResourceView>

      <section aria-label="Gráficos y próximas citas" className="mt-8 grid grid-cols-12 gap-6">
        <ChartCard
          className="col-span-12 lg:col-span-8"
          title="Citas por día"
          subtitle={`${chartSubtitle} · incluye todos los estados`}
          action={
            <Link to={agendaLink({ view: "week", date: today })} className="font-medium">
              Ver agenda
            </Link>
          }
        >
          <ResourceView state={appointments} errorTitle="No se pudieron cargar las citas" onRetry={reloadAppointments}>
            {(trend) =>
              trend.series.some((point) => point.value > 0) ? (
                <BarChart
                  ariaLabel="Citas por día"
                  data={trend.series.map((point) => ({
                    label: formatDayMonth(point.period),
                    value: point.value,
                    description: `${formatDayMonth(point.period)}: ${pluralize(point.value, "cita", "citas")}`,
                  }))}
                />
              ) : (
                <EmptyState
                  compact
                  icon={CalendarX2}
                  title="Todavía no hay citas registradas en este período"
                  description="Cuando agendes citas, verás aquí su evolución día a día."
                  actions={createAppointmentAction}
                />
              )
            }
          </ResourceView>
        </ChartCard>

        <ChartCard
          className="col-span-12 lg:col-span-4"
          title="Próximas citas"
          subtitle="Pendientes, confirmadas y en curso"
          action={
            <Link to={agendaLink({ view: "week", date: today })} className="font-medium">
              Ver toda la agenda
            </Link>
          }
        >
          <ResourceView state={upcoming} errorTitle="No se pudieron cargar las próximas citas" onRetry={reloadUpcoming}>
            {(items) =>
              items.length > 0 ? (
                <UpcomingAppointments appointments={items} today={today} />
              ) : (
                <EmptyState
                  compact
                  icon={CalendarX2}
                  title="No hay citas próximas"
                  description="Las citas pendientes y confirmadas aparecerán aquí."
                  actions={createAppointmentAction}
                />
              )
            }
          </ResourceView>
        </ChartCard>

        <ChartCard
          className="col-span-12 lg:col-span-4"
          title="Servicios más solicitados"
          subtitle={`${PERIOD_LABELS[period]} · por número de citas`}
        >
          <ResourceView state={services} errorTitle="No se pudieron cargar los servicios" onRetry={reloadServices} skeletonClassName="h-40">
            {(items) =>
              items.length > 0 ? (
                <TopServicesList services={items} />
              ) : (
                <EmptyState
                  compact
                  icon={ListChecks}
                  title="Sin servicios solicitados"
                  description="Aún no hay citas en este período."
                  actions={createAppointmentAction}
                />
              )
            }
          </ResourceView>
        </ChartCard>

        {financial && (
          <ChartCard
            className="col-span-12 lg:col-span-8"
            title="Ingresos por día"
            subtitle={`${chartSubtitle} · pagos registrados como cobrados`}
            action={
              <Link to="/pagos" className="font-medium">
                Ver pagos
              </Link>
            }
          >
            <ResourceView state={revenue} errorTitle="No se pudieron cargar los ingresos" onRetry={reloadRevenue}>
              {(trend) =>
                trend.series.some((point) => point.value > 0) ? (
                  <LineChart
                    ariaLabel="Ingresos por día"
                    formatTick={(value) => formatCurrencyCompact(value, currency)}
                    data={trend.series.map((point) => ({
                      label: formatDayMonth(point.period),
                      value: point.value,
                      description: `${formatDayMonth(point.period)}: ${formatCurrency(point.value, currency)}`,
                    }))}
                  />
                ) : (
                  <EmptyState
                    compact
                    icon={Banknote}
                    title="Todavía no hay ingresos registrados en este período"
                    description="Los pagos que registres como cobrados aparecerán aquí."
                    actions={
                      <Link to="/pagos" className={buttonStyles({ size: "sm" })}>
                        Registrar un pago
                      </Link>
                    }
                  />
                )
              }
            </ResourceView>
          </ChartCard>
        )}
      </section>

      <QuickActions />
    </div>
  );
}

interface ResourceStatProps {
  state: AsyncState<Trend>;
  label: string;
  icon: LucideIcon;
  format: (trend: Trend) => string;
  linkTo: string;
  linkLabel: string;
  periodLabel: string;
}

/** Tarjeta cuyo valor depende de una carga propia: muestra «—» mientras llega o si falla. */
function ResourceStat({ state, label, icon, format, linkTo, linkLabel, periodLabel }: ResourceStatProps) {
  const ready = state.status === "ready";
  return (
    <StatCard
      className="col-span-12 sm:col-span-6 xl:col-span-3"
      label={label}
      value={ready ? format(state.data) : "—"}
      icon={icon}
      detail={
        ready ? (
          trendDetail(state.data)
        ) : state.status === "error" ? (
          "No se pudo cargar este dato."
        ) : (
          <span aria-busy="true">Cargando {periodLabel}...</span>
        )
      }
      footer={
        <Link to={linkTo} className="font-medium">
          {linkLabel}
        </Link>
      }
    />
  );
}
