import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Customer, CustomerHistory, CustomerInput } from "@/types/customer";

export interface CustomerListParams {
  page?: number;
  ordering?: string;
  status?: string;
  q?: string;
}

export async function listCustomers(params: CustomerListParams): Promise<Paginated<Customer>> {
  const endpoint = params.q ? "/customers/search/" : "/customers/";
  const response = await apiClient.get<Paginated<Customer>>(endpoint, { params });
  return response.data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const response = await apiClient.get<Customer>(`/customers/${id}/`);
  return response.data;
}

export async function getCustomerHistory(id: string): Promise<CustomerHistory> {
  const response = await apiClient.get<CustomerHistory>(`/customers/${id}/history/`);
  return response.data;
}

export async function createCustomer(payload: Partial<CustomerInput>): Promise<Customer> {
  const response = await apiClient.post<Customer>("/customers/", payload);
  return response.data;
}

export async function updateCustomer(id: string, payload: Partial<CustomerInput>): Promise<Customer> {
  const response = await apiClient.patch<Customer>(`/customers/${id}/`, payload);
  return response.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiClient.delete(`/customers/${id}/`);
}
