import { type FormEvent, useCallback, useEffect, useState } from "react";

import { ApiError } from "@/api/client";
import { createTask, listTasks, updateTaskStatus } from "@/features/tasks/api";
import { TASK_STATUS_LABELS } from "@/types/task";
import type { Task, TaskOwnerType } from "@/types/task";

interface TasksPanelProps {
  ownerType: TaskOwnerType;
  ownerId: string;
}

export function TasksPanel({ ownerType, ownerId }: TasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTasks(ownerType, ownerId);
      setTasks(data.results);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo cargar la lista de tareas.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ownerType, ownerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!title) return;
    setCreating(true);
    setError(null);
    try {
      await createTask({ owner_type: ownerType, owner_id: ownerId, title, due_date: dueDate || null });
      setTitle("");
      setDueDate("");
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo agregar la tarea.";
      setError(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleComplete(task: Task) {
    try {
      await updateTaskStatus(task.id, "completed");
      await load();
    } catch {
      setError("No se pudo actualizar la tarea.");
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading && <p>Cargando...</p>}
      {!loading && tasks.length === 0 && <p>Sin tareas todavía.</p>}

      {!loading && tasks.length > 0 && (
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
                <td>{TASK_STATUS_LABELS[task.status]}</td>
                <td>
                  {task.status !== "completed" && task.status !== "cancelled" && (
                    <button type="button" onClick={() => handleComplete(task)}>
                      Marcar completada
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleCreate} className="auth-form">
        <label htmlFor={`task-title-${ownerId}`}>Título</label>
        <input id={`task-title-${ownerId}`} value={title} onChange={(e) => setTitle(e.target.value)} required />

        <label htmlFor={`task-due-${ownerId}`}>Fecha límite</label>
        <input
          id={`task-due-${ownerId}`}
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />

        <button type="submit" disabled={creating}>
          {creating ? "Agregando..." : "Agregar tarea"}
        </button>
      </form>
    </div>
  );
}
