export type WorkOrderStatus =
  | "received"
  | "diagnosis"
  | "awaiting_authorization"
  | "in_repair"
  | "awaiting_part"
  | "finished"
  | "delivered";

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  received: "Recibida",
  diagnosis: "En diagnóstico",
  awaiting_authorization: "Esperando autorización",
  in_repair: "En reparación",
  awaiting_part: "Esperando repuesto",
  finished: "Terminada",
  delivered: "Entregada",
};

// Debe reflejar VALID_WORK_ORDER_TRANSITIONS de apps/modules/moto/models.py.
export const VALID_WORK_ORDER_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  received: ["diagnosis"],
  diagnosis: ["awaiting_authorization"],
  awaiting_authorization: ["in_repair"],
  in_repair: ["awaiting_part", "finished"],
  awaiting_part: ["in_repair"],
  finished: ["delivered"],
  delivered: [],
};

export interface Motorcycle {
  id: string;
  customer: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  color: string;
  vin: string;
  engine_number: string;
  mileage: number;
  purchase_date: string | null;
  notes: string;
}

export type MotorcycleInput = Omit<Motorcycle, "id">;

export interface VehicleHistoryEntry {
  id: string;
  motorcycle: string;
  service_date: string;
  mileage: number;
  service_description: string;
  diagnosis: string;
  parts_used: string;
  labor_description: string;
  technician: string | null;
  cost: string;
  notes: string;
  created_at: string;
}

export type WorkOrderItemType = "part" | "labor";

export const WORK_ORDER_ITEM_TYPE_LABELS: Record<WorkOrderItemType, string> = {
  part: "Repuesto",
  labor: "Mano de obra",
};

export interface WorkOrderItem {
  id: string;
  item_type: WorkOrderItemType;
  description: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface WorkOrder {
  id: string;
  motorcycle: string;
  appointment: string | null;
  status: WorkOrderStatus;
  total: string;
  diagnosis_notes: string;
  received_at: string;
  delivered_at: string | null;
  items: WorkOrderItem[];
}
