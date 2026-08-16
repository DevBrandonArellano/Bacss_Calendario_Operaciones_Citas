export type CasePriority = "low" | "medium" | "high";

export const CASE_PRIORITY_LABELS: Record<CasePriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export type LegalCaseStatus = "new" | "in_review" | "active" | "on_hold" | "closed" | "archived";

export const LEGAL_CASE_STATUS_LABELS: Record<LegalCaseStatus, string> = {
  new: "Nuevo",
  in_review: "En revisión",
  active: "Activo",
  on_hold: "En espera",
  closed: "Cerrado",
  archived: "Archivado",
};

// Debe reflejar VALID_CASE_TRANSITIONS de apps/modules/legal/models.py.
export const VALID_CASE_TRANSITIONS: Record<LegalCaseStatus, LegalCaseStatus[]> = {
  new: ["in_review", "closed"],
  in_review: ["active", "closed"],
  active: ["on_hold", "closed"],
  on_hold: ["active", "closed"],
  closed: ["archived", "active"],
  archived: [],
};

export interface LegalCase {
  id: string;
  case_number: string;
  customer: string;
  case_type: string;
  responsible_lawyer: string;
  status: LegalCaseStatus;
  opened_at: string;
  closed_at: string | null;
  priority: CasePriority;
  description: string;
}

export interface CaseEvent {
  id: string;
  legal_case: string;
  event_at: string;
  event_type: string;
  description: string;
  created_by_user: string | null;
  created_at: string;
}

export type HearingStatus = "scheduled" | "held" | "postponed" | "cancelled";

export const HEARING_STATUS_LABELS: Record<HearingStatus, string> = {
  scheduled: "Programada",
  held: "Realizada",
  postponed: "Postergada",
  cancelled: "Cancelada",
};

export interface Hearing {
  id: string;
  legal_case: string;
  scheduled_at: string;
  location: string;
  status: HearingStatus;
  notes: string;
}

export type CaseTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export const CASE_TASK_STATUS_LABELS: Record<CaseTaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export interface CaseTask {
  id: string;
  legal_case: string;
  title: string;
  description: string;
  assigned_to_user: string | null;
  due_date: string | null;
  priority: CasePriority;
  status: CaseTaskStatus;
}
