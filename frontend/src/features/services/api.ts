import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Service, ServiceInput } from "@/types/service";

export interface ServiceListParams {
  page?: number;
  ordering?: string;
  status?: string;
}

export async function listServices(params: ServiceListParams): Promise<Paginated<Service>> {
  const response = await apiClient.get<Paginated<Service>>("/services/", { params });
  return response.data;
}

export async function getService(id: string): Promise<Service> {
  const response = await apiClient.get<Service>(`/services/${id}/`);
  return response.data;
}

export async function createService(payload: Partial<ServiceInput>): Promise<Service> {
  const response = await apiClient.post<Service>("/services/", payload);
  return response.data;
}

export async function updateService(id: string, payload: Partial<ServiceInput>): Promise<Service> {
  const response = await apiClient.patch<Service>(`/services/${id}/`, payload);
  return response.data;
}

export async function deleteService(id: string): Promise<void> {
  await apiClient.delete(`/services/${id}/`);
}
