import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/AuthContext";
import { getGeneralReport, getModuleReport } from "@/features/reports/api";
import { STATUS_LABELS } from "@/types/appointment";
import type { GeneralReport } from "@/types/report";

const MODULE_LABELS: Record<string, string> = {
  moto: "Taller de motos",
  laboratory: "Laboratorio clínico",
  store: "Tienda / lanzamientos",
  legal: "Legal",
};

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function ReportValue({ value }: { value: unknown }) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return <ReportObject data={value as Record<string, unknown>} />;
  }
  if (Array.isArray(value)) {
    return (
      <ul>
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === "object" && item !== null ? <ReportObject data={item as Record<string, unknown>} /> : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  return <>{String(value)}</>;
}

function ReportObject({ data }: { data: Record<string, unknown> }) {
  return (
    <dl>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="toolbar">
          <dt>{humanizeKey(key)}:</dt>
          <dd>
            <ReportValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { activeModules, modulesLoaded } = useAuth();
  const [dateFrom, setDateFrom] = useState(isoDaysAgo(30));
  const [dateTo, setDateTo] = useState(isoDaysAgo(0));
  const [report, setReport] = useState<GeneralReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [moduleCode, setModuleCode] = useState<string | null>(null);
  const [moduleReport, setModuleReport] = useState<Record<string, unknown> | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getGeneralReport(dateFrom, dateTo);
      setReport(data);
    } catch {
      setError("No se pudo cargar el reporte.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleModuleReport(code: string) {
    setModuleCode(code);
    setModuleError(null);
    setModuleReport(null);
    try {
      const data = await getModuleReport(code, dateFrom, dateTo);
      setModuleReport(data);
    } catch {
      setModuleError("No se pudo cargar el reporte del módulo.");
    }
  }

  return (
    <div>
      <h1>Reportes</h1>

      <div className="toolbar">
        <label htmlFor="date-from">Desde</label>
        <input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label htmlFor="date-to">Hasta</label>
        <input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button type="button" onClick={load}>
          Aplicar
        </button>
        <Link to="/dashboard">Volver al dashboard</Link>
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading && <p>Cargando...</p>}

      {!loading && report && (
        <>
          <div className="stat-tiles">
            <div className="stat-tile">
              <span className="stat-tile-label">Citas totales</span>
              <span className="stat-tile-value">{report.appointments.total}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Tasa de cancelación</span>
              <span className="stat-tile-value">{Math.round(report.cancellations.rate * 100)}%</span>
            </div>
            {report.customers && (
              <div className="stat-tile">
                <span className="stat-tile-label">Clientes nuevos</span>
                <span className="stat-tile-value">{report.customers.new}</span>
              </div>
            )}
            {report.revenue && (
              <div className="stat-tile">
                <span className="stat-tile-label">Ingresos</span>
                <span className="stat-tile-value">{report.revenue.total}</span>
              </div>
            )}
          </div>

          <h2>Citas por estado</h2>
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.appointments.by_status).map(([statusCode, count]) => (
                <tr key={statusCode}>
                  <td>{STATUS_LABELS[statusCode as keyof typeof STATUS_LABELS] ?? statusCode}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {report.productivity && report.productivity.length > 0 && (
            <>
              <h2>Productividad</h2>
              <table>
                <thead>
                  <tr>
                    <th>Profesional</th>
                    <th>Citas completadas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.productivity.map((row) => (
                    <tr key={row.employee_id}>
                      <td>{row.employee_name}</td>
                      <td>{row.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {modulesLoaded && activeModules.length > 0 && (
        <>
          <h2>Reportes por módulo</h2>
          <div className="toolbar">
            {activeModules.map((code) => (
              <button key={code} type="button" onClick={() => handleModuleReport(code)}>
                {MODULE_LABELS[code] ?? code}
              </button>
            ))}
          </div>

          {moduleError && (
            <p role="alert" className="form-error">
              {moduleError}
            </p>
          )}
          {moduleCode && moduleReport && (
            <div>
              <h3>{MODULE_LABELS[moduleCode] ?? moduleCode}</h3>
              <ReportObject data={moduleReport} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
