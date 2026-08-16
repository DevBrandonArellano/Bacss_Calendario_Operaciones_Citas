import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getChartData, getDashboard } from "@/features/reports/api";
import { SimpleBarChart } from "@/features/reports/SimpleBarChart";
import { STATUS_LABELS } from "@/types/appointment";
import type { DashboardSummary } from "@/types/report";

const TREND_DAYS = 14;

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [appointmentsTrend, setAppointmentsTrend] = useState<{ label: string; value: number }[]>([]);
  const [topServices, setTopServices] = useState<{ label: string; value: number }[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<{ label: string; value: number; displayValue: string }[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const dashboard = await getDashboard();
      setSummary(dashboard);

      const dateFrom = isoDaysAgo(TREND_DAYS);
      const appointments = await getChartData("appointments", "day", dateFrom);
      setAppointmentsTrend(
        appointments.data.map((point) => ({ label: point.period ?? "", value: point.count ?? 0 }))
      );

      const services = await getChartData("top_services", "day", dateFrom);
      setTopServices(
        services.data.map((point) => ({ label: point.service_name ?? "", value: point.count ?? 0 }))
      );

      if (dashboard.revenue_this_month !== undefined) {
        const revenue = await getChartData("revenue", "day", dateFrom);
        setRevenueTrend(
          revenue.data.map((point) => ({
            label: point.period ?? "",
            value: Number(point.total ?? 0),
            displayValue: point.total ?? "0",
          }))
        );
      }
    }

    load()
      .catch(() => setError("No se pudo cargar el dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!summary) return null;

  const statusEntries = Object.entries(summary.today_by_status);

  return (
    <div>
      <div className="toolbar">
        <h1>Dashboard</h1>
        <Link to="/reportes">Ver reporte general</Link>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-tile-label">Citas hoy</span>
          <span className="stat-tile-value">{summary.today_total}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-label">Próximos 7 días</span>
          <span className="stat-tile-value">{summary.upcoming_7_days}</span>
        </div>
        {summary.new_customers_this_month !== undefined && (
          <div className="stat-tile">
            <span className="stat-tile-label">Clientes nuevos (mes)</span>
            <span className="stat-tile-value">{summary.new_customers_this_month}</span>
          </div>
        )}
        {summary.revenue_this_month !== undefined && (
          <div className="stat-tile">
            <span className="stat-tile-label">Ingresos (mes)</span>
            <span className="stat-tile-value">{summary.revenue_this_month}</span>
          </div>
        )}
      </div>

      {statusEntries.length > 0 && (
        <div className="toolbar">
          {statusEntries.map(([statusCode, count]) => (
            <span key={statusCode} className={`badge badge-status-${statusCode}`}>
              {STATUS_LABELS[statusCode as keyof typeof STATUS_LABELS] ?? statusCode}: {count}
            </span>
          ))}
        </div>
      )}

      <SimpleBarChart title={`Citas por día (últimos ${TREND_DAYS} días)`} data={appointmentsTrend} />
      <SimpleBarChart title="Servicios más solicitados" data={topServices} />
      {revenueTrend && <SimpleBarChart title={`Ingresos por día (últimos ${TREND_DAYS} días)`} data={revenueTrend} />}
    </div>
  );
}
