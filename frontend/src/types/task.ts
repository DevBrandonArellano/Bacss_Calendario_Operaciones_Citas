export type TaskOwnerType = "customer" | "appointment" | "case" | "work_order" | "order";

export type TaskPriority = "low" | "medium" | "high";

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export interface Task {
  id: string;
  owner_type: TaskOwnerType;
  owner_id: string;
  title: string;
  description: string;
  assigned_to_user: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
}
