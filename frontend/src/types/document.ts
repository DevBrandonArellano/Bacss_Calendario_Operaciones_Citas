export type DocumentOwnerType = "customer" | "appointment" | "case" | "work_order" | "patient" | "order";

export const DOCUMENT_OWNER_TYPE_LABELS: Record<DocumentOwnerType, string> = {
  customer: "Cliente",
  appointment: "Cita",
  case: "Caso legal",
  work_order: "Orden de trabajo",
  patient: "Paciente",
  order: "Pedido",
};

export interface Document {
  id: string;
  owner_type: DocumentOwnerType;
  owner_id: string;
  name: string;
  file: string;
  file_type: string;
  size_bytes: number;
  version: number;
  status: "active" | "archived";
  uploaded_by_user: string | null;
  created_at: string;
}
