import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { DocumentsPanel } from "@/features/documents/DocumentsPanel";
import {
  addCaseEvent,
  createCaseTask,
  createHearing,
  getLegalCase,
  listCaseEvents,
  listCaseTasks,
  listHearings,
  transitionLegalCase,
  updateCaseTask,
} from "@/features/legal/api";
import {
  CASE_TASK_STATUS_LABELS,
  HEARING_STATUS_LABELS,
  LEGAL_CASE_STATUS_LABELS,
  VALID_CASE_TRANSITIONS,
} from "@/types/legal";
import type { CaseEvent, CaseTask, Hearing, LegalCase, LegalCaseStatus } from "@/types/legal";

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const [eventType, setEventType] = useState("note");
  const [eventDescription, setEventDescription] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);

  const [hearingDate, setHearingDate] = useState("");
  const [hearingLocation, setHearingLocation] = useState("");
  const [addingHearing, setAddingHearing] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  async function loadAll(caseId: string) {
    const [caseData, eventsData, hearingsData, tasksData] = await Promise.all([
      getLegalCase(caseId),
      listCaseEvents(caseId),
      listHearings(caseId),
      listCaseTasks(caseId),
    ]);
    setLegalCase(caseData);
    setEvents(eventsData.results);
    setHearings(hearingsData.results);
    setTasks(tasksData.results);
  }

  useEffect(() => {
    if (!id) return;
    loadAll(id)
      .catch(() => setError("No se pudo cargar el caso."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleTransition(newStatus: LegalCaseStatus) {
    if (!id) return;
    setTransitioning(true);
    setError(null);
    try {
      await transitionLegalCase(id, newStatus);
      await loadAll(id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo cambiar el estado.";
      setError(message);
    } finally {
      setTransitioning(false);
    }
  }

  async function handleAddEvent(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setAddingEvent(true);
    try {
      await addCaseEvent(id, { event_type: eventType, description: eventDescription });
      setEventDescription("");
      await loadAll(id);
    } catch {
      setError("No se pudo agregar el evento.");
    } finally {
      setAddingEvent(false);
    }
  }

  async function handleAddHearing(event: FormEvent) {
    event.preventDefault();
    if (!id || !hearingDate) return;
    setAddingHearing(true);
    try {
      await createHearing({ legal_case: id, scheduled_at: hearingDate, location: hearingLocation });
      setHearingDate("");
      setHearingLocation("");
      await loadAll(id);
    } catch {
      setError("No se pudo agregar la audiencia.");
    } finally {
      setAddingHearing(false);
    }
  }

  async function handleAddTask(event: FormEvent) {
    event.preventDefault();
    if (!id || !taskTitle) return;
    setAddingTask(true);
    try {
      await createCaseTask({ legal_case: id, title: taskTitle, due_date: taskDueDate || null });
      setTaskTitle("");
      setTaskDueDate("");
      await loadAll(id);
    } catch {
      setError("No se pudo agregar la tarea.");
    } finally {
      setAddingTask(false);
    }
  }

  async function handleCompleteTask(task: CaseTask) {
    if (!id) return;
    try {
      await updateCaseTask(task.id, { status: "completed" });
      await loadAll(id);
    } catch {
      setError("No se pudo actualizar la tarea.");
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (error && !legalCase) return <p className="form-error">{error}</p>;
  if (!legalCase) return null;

  const nextStatuses = VALID_CASE_TRANSITIONS[legalCase.status];

  return (
    <div>
      <Link to="/legal/casos">&larr; Volver a casos</Link>
      <div className="toolbar">
        <h1>Caso {legalCase.case_number}</h1>
        <span className={`badge badge-status-${legalCase.status}`}>
          {LEGAL_CASE_STATUS_LABELS[legalCase.status]}
        </span>
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <p>Tipo: {legalCase.case_type}</p>
      {legalCase.description && <p>Descripción: {legalCase.description}</p>}

      <h2>Cambiar estado</h2>
      {nextStatuses.length === 0 ? (
        <p>Este caso llegó a su estado final.</p>
      ) : (
        <div className="toolbar">
          {nextStatuses.map((status) => (
            <button key={status} type="button" disabled={transitioning} onClick={() => handleTransition(status)}>
              Pasar a: {LEGAL_CASE_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}

      <h2>Documentos</h2>
      <DocumentsPanel ownerType="case" ownerId={legalCase.id} />

      <h2>Cronología</h2>
      {events.length === 0 ? (
        <p>Sin eventos todavía.</p>
      ) : (
        <ul className="notification-list">
          {events.map((caseEvent) => (
            <li key={caseEvent.id} className="notification-item">
              <p className="notification-item-subject">{caseEvent.event_type}</p>
              {caseEvent.description && <p className="notification-item-body">{caseEvent.description}</p>}
              <p className="notification-item-footer">{new Date(caseEvent.event_at).toLocaleString("es-EC")}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAddEvent} className="auth-form">
        <label htmlFor="event-type">Tipo de evento</label>
        <input id="event-type" value={eventType} onChange={(e) => setEventType(e.target.value)} required />
        <label htmlFor="event-description">Descripción</label>
        <textarea
          id="event-description"
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
        />
        <button type="submit" disabled={addingEvent}>
          {addingEvent ? "Agregando..." : "Agregar evento"}
        </button>
      </form>

      <h2>Audiencias</h2>
      {hearings.length === 0 ? (
        <p>Sin audiencias programadas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Lugar</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {hearings.map((hearing) => (
              <tr key={hearing.id}>
                <td>{new Date(hearing.scheduled_at).toLocaleString("es-EC")}</td>
                <td>{hearing.location || "—"}</td>
                <td>{HEARING_STATUS_LABELS[hearing.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={handleAddHearing} className="auth-form">
        <label htmlFor="hearing-date">Fecha y hora</label>
        <input
          id="hearing-date"
          type="datetime-local"
          value={hearingDate}
          onChange={(e) => setHearingDate(e.target.value)}
          required
        />
        <label htmlFor="hearing-location">Lugar</label>
        <input id="hearing-location" value={hearingLocation} onChange={(e) => setHearingLocation(e.target.value)} />
        <button type="submit" disabled={addingHearing}>
          {addingHearing ? "Agregando..." : "Programar audiencia"}
        </button>
      </form>

      <h2>Tareas</h2>
      {tasks.length === 0 ? (
        <p>Sin tareas todavía.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Vence</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.due_date ?? "—"}</td>
                <td>{CASE_TASK_STATUS_LABELS[task.status]}</td>
                <td>
                  {task.status !== "completed" && task.status !== "cancelled" && (
                    <button type="button" onClick={() => handleCompleteTask(task)}>
                      Marcar completada
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={handleAddTask} className="auth-form">
        <label htmlFor="task-title">Título</label>
        <input id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required />
        <label htmlFor="task-due-date">Fecha límite</label>
        <input id="task-due-date" type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
        <button type="submit" disabled={addingTask}>
          {addingTask ? "Agregando..." : "Agregar tarea"}
        </button>
      </form>
    </div>
  );
}
