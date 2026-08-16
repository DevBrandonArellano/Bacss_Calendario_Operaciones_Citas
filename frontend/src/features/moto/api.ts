import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Motorcycle,
  MotorcycleInput,
  VehicleHistoryEntry,
  WorkOrder,
  WorkOrderItem,
  WorkOrderItemType,
  WorkOrderStatus,
} from "@/types/moto";

export async function listMotorcycles(
  params: { page?: number; customer?: string } = {}
): Promise<Paginated<Motorcycle>> {
  const response = await apiClient.get<Paginated<Motorcycle>>("/modules/moto/motorcycles/", { params });
  return response.data;
}

export async function getMotorcycle(id: string): Promise<Motorcycle> {
  const response = await apiClient.get<Motorcycle>(`/modules/moto/motorcycles/${id}/`);
  return response.data;
}

export async function createMotorcycle(payload: Partial<MotorcycleInput>): Promise<Motorcycle> {
  const response = await apiClient.post<Motorcycle>("/modules/moto/motorcycles/", payload);
  return response.data;
}

export async function updateMotorcycle(id: string, payload: Partial<MotorcycleInput>): Promise<Motorcycle> {
  const response = await apiClient.patch<Motorcycle>(`/modules/moto/motorcycles/${id}/`, payload);
  return response.data;
}

export async function listMotorcycleHistory(motorcycleId: string): Promise<Paginated<VehicleHistoryEntry>> {
  const response = await apiClient.get<Paginated<VehicleHistoryEntry>>(
    `/modules/moto/motorcycles/${motorcycleId}/history/`
  );
  return response.data;
}

export interface AddHistoryPayload {
  service_date: string;
  mileage: number;
  service_description: string;
  diagnosis?: string;
  cost?: string;
}

export async function addMotorcycleHistory(
  motorcycleId: string,
  payload: AddHistoryPayload
): Promise<VehicleHistoryEntry> {
  const response = await apiClient.post<VehicleHistoryEntry>(
    `/modules/moto/motorcycles/${motorcycleId}/history/`,
    payload
  );
  return response.data;
}

export async function listWorkOrders(
  params: { page?: number; status?: string; motorcycle?: string } = {}
): Promise<Paginated<WorkOrder>> {
  const response = await apiClient.get<Paginated<WorkOrder>>("/modules/moto/work-orders/", { params });
  return response.data;
}

export async function getWorkOrder(id: string): Promise<WorkOrder> {
  const response = await apiClient.get<WorkOrder>(`/modules/moto/work-orders/${id}/`);
  return response.data;
}

export async function createWorkOrder(payload: {
  motorcycle_id: string;
  diagnosis_notes?: string;
}): Promise<WorkOrder> {
  const response = await apiClient.post<WorkOrder>("/modules/moto/work-orders/", payload);
  return response.data;
}

export async function transitionWorkOrder(id: string, status: WorkOrderStatus): Promise<WorkOrder> {
  const response = await apiClient.post<WorkOrder>(`/modules/moto/work-orders/${id}/transition/`, {
    status,
  });
  return response.data;
}

export async function addWorkOrderItem(
  id: string,
  payload: { item_type: WorkOrderItemType; description: string; quantity: number; unit_price: string }
): Promise<WorkOrderItem> {
  const response = await apiClient.post<WorkOrderItem>(`/modules/moto/work-orders/${id}/items/`, payload);
  return response.data;
}
