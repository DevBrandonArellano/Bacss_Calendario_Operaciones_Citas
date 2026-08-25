import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  listAppointments,
  rescheduleAppointment,
  startAppointment,
} from "@/features/appointments/api";
import { CancelAppointmentDialog } from "@/features/appointments/CancelAppointmentDialog";
import { RescheduleDialog } from "@/features/appointments/RescheduleDialog";
import { listCustomers } from "@/features/customers/api";
import { listEmployees } from "@/features/employees/api";
import { listServices } from "@/features/services/api";
import { addDays, endOfMonth, formatDateEs, startOfMonth, startOfWeek, toISODate, weekdayLabel } from "@/lib/dates";
import type { Appointment } from "@/types/appointment";
import { STATUS_LABELS } from "@/types/appointment";
import type { Employee } from "@/types/service";

type ViewMode = "day" | "week" | "month" | "agenda";

function computeRange(mode: ViewMode, current: Date): { from: Date; to: Date } {
  if (mode === "day") return { from: current, to: current };
  if (mode === "week") {
    const from = startOfWeek(current);
    return { from, to: addDays(from, 6) };
  }
  if (mode === "month") {
    return { from: startOfMonth(current), to: endOfMonth(current) };
  }
  // agenda: próximos 30 días
  return { from: current, to: addDays(current, 30) };
}

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);

  const range = useMemo(() => computeRange(viewMode, currentDate), [viewMode, currentDate]);

  useEffect(() => {
    listEmployees({ page: 1 }).then((data) => setEmployees(data.results));
    listServices({ page: 1, ordering: "name" }).then((data) =>
      setServiceNames(Object.fromEntries(data.results.map((s) => [s.id, s.name])))
    );
    listCustomers({ page: 1 }).then((data) =>
      setCustomerNames(Object.fromEntries(data.results.map((c) => [c.id, c.full_name])))
    );
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAppointments({
        appointment_date__gte: toISODate(range.from),
        appointment_date__lte: toISODate(range.to),
        employee: viewMode === "agenda" ? employeeId || undefined : undefined,
      });
      setAppointments(data.results);
    } catch {
      setError("No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  }, [range, viewMode, employeeId]);

  useEffect(() => {
    if (viewMode === "agenda" && !employeeId) {
      setAppointments([]);
      return;
    }
    fetchAppointments();
  }, [fetchAppointments, viewMode, employeeId]);

  function step(direction: 1 | -1) {
    if (viewMode === "day") setCurrentDate((d) => addDays(d, direction));
    else if (viewMode === "week") setCurrentDate((d) => addDays(d, 7 * direction));
    else if (viewMode === "month")
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
    else setCurrentDate((d) => addDays(d, 30 * direction));
  }

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const list = groups.get(appointment.appointment_date) ?? [];
      list.push(appointment);
      groups.set(appointment.appointment_date, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [appointments]);

  async function handleAction(action: () => Promise<Appointment>) {
    try {
      await action();
      await fetchAppointments();
    } catch {
      setError("No se pudo completar la acción.");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <h1>Agenda</h1>
        <Link to="/citas/nueva">
          <button type="button">Nueva cita</button>
        </Link>
      </div>

      <div className="toolbar">
        {(["day", "week", "month", "agenda"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            aria-pressed={viewMode === mode}
            className={viewMode === mode ? "view-mode-active" : undefined}
          >
            {{ day: "Día", week: "Semana", month: "Mes", agenda: "Agenda por profesional" }[mode]}
          </button>
        ))}
      </div>

      {viewMode === "agenda" ? (
        <div className="toolbar">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} aria-label="Profesional">
            <option value="">Selecciona un profesional</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="toolbar">
          <button type="button" onClick={() => step(-1)}>
            &larr; Anterior
          </button>
          <span>
            {formatDateEs(range.from)} — {formatDateEs(range.to)}
          </span>
          <button type="button" onClick={() => step(1)}>
            Siguiente &rarr;
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Cargando...</p>}
      {!loading && viewMode === "agenda" && !employeeId && <p>Selecciona un profesional para ver su agenda.</p>}
      {!loading && groupedByDate.length === 0 && (viewMode !== "agenda" || employeeId) && (
        <p>No hay citas en este rango.</p>
      )}

      {groupedByDate.map(([dateStr, items]) => (
        <section key={dateStr}>
          <h2>
            {weekdayLabel(new Date(`${dateStr}T00:00:00`))} {dateStr}
          </h2>
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Servicio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      {appointment.start_time.slice(0, 5)}–{appointment.end_time.slice(0, 5)}
                    </td>
                    <td>{customerNames[appointment.customer] ?? appointment.customer}</td>
                    <td>{serviceNames[appointment.service] ?? appointment.service}</td>
                    <td>{STATUS_LABELS[appointment.status]}</td>
                    <td>
                      {appointment.status === "pending" && (
                        <button type="button" onClick={() => handleAction(() => confirmAppointment(appointment.id))}>
                          Confirmar
                        </button>
                      )}
                      {(appointment.status === "confirmed" || appointment.status === "waiting") && (
                        <button type="button" onClick={() => handleAction(() => startAppointment(appointment.id))}>
                          Iniciar
                        </button>
                      )}
                      {appointment.status === "in_progress" && (
                        <button type="button" onClick={() => handleAction(() => completeAppointment(appointment.id))}>
                          Completar
                        </button>
                      )}
                      {["pending", "confirmed"].includes(appointment.status) && (
                        <button type="button" onClick={() => setRescheduleTarget(appointment)}>
                          Reprogramar
                        </button>
                      )}
                      {["pending", "confirmed", "waiting"].includes(appointment.status) && (
                        <button type="button" onClick={() => setCancelTarget(appointment)}>
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}

      {cancelTarget && (
        <CancelAppointmentDialog
          onConfirm={(reason) => {
            handleAction(() => cancelAppointment(cancelTarget.id, reason));
            setCancelTarget(null);
          }}
          onCancel={() => setCancelTarget(null)}
        />
      )}

      {rescheduleTarget && (
        <RescheduleDialog
          appointment={rescheduleTarget}
          onConfirm={(date, startTime) => {
            handleAction(() => rescheduleAppointment(rescheduleTarget.id, date, startTime));
            setRescheduleTarget(null);
          }}
          onCancel={() => setRescheduleTarget(null)}
        />
      )}
    </div>
  );
}
