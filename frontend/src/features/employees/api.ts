import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Employee, EmployeeInput } from "@/types/service";

export interface EmployeeListParams {
  page?: number;
  ordering?: string;
  is_active?: boolean;
}

export async function listEmployees(params: EmployeeListParams): Promise<Paginated<Employee>> {
  const response = await apiClient.get<Paginated<Employee>>("/employees/", { params });
  return response.data;
}

export async function getEmployee(id: string): Promise<Employee> {
  const response = await apiClient.get<Employee>(`/employees/${id}/`);
  return response.data;
}

export async function createEmployee(payload: Partial<EmployeeInput>): Promise<Employee> {
  const response = await apiClient.post<Employee>("/employees/", payload);
  return response.data;
}

export async function updateEmployee(id: string, payload: Partial<EmployeeInput>): Promise<Employee> {
  const response = await apiClient.patch<Employee>(`/employees/${id}/`, payload);
  return response.data;
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiClient.delete(`/employees/${id}/`);
}

export async function setEmployeeServices(id: string, serviceIds: string[]): Promise<Employee> {
  const response = await apiClient.post<Employee>(`/employees/${id}/services/`, {
    service_ids: serviceIds,
  });
  return response.data;
}
