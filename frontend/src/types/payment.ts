export type PaymentMethod = "cash" | "transfer" | "card" | "other";
export type PaymentStatus = "pending" | "paid" | "refunded";

export interface Payment {
  id: string;
  appointment: string | null;
  appointment_date: string | null;
  customer: string;
  customer_name: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string | null;
  refunded_at: string | null;
  notes: string;
  created_at: string;
}

export interface PaymentInput {
  customer_id: string;
  appointment_id?: string | null;
  amount: string;
  method: PaymentMethod;
  notes?: string;
}
