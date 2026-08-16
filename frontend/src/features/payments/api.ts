import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Payment, PaymentInput } from "@/types/payment";

export interface PaymentListParams {
  page?: number;
  customer?: string;
  status?: string;
}

export async function listPayments(params: PaymentListParams = {}): Promise<Paginated<Payment>> {
  const response = await apiClient.get<Paginated<Payment>>("/payments/", { params });
  return response.data;
}

export async function createPayment(payload: PaymentInput): Promise<Payment> {
  const response = await apiClient.post<Payment>("/payments/", payload);
  return response.data;
}

export async function refundPayment(id: string, reason?: string): Promise<Payment> {
  const response = await apiClient.post<Payment>(`/payments/${id}/refund/`, reason ? { reason } : {});
  return response.data;
}
