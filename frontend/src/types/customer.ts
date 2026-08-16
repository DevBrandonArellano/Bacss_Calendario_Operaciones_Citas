import type { Payment } from "@/types/payment";

export type CustomerStatus = "active" | "inactive";

export interface Customer {
  id: string;
  branch: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  document_type: string;
  document_number: string;
  phone: string;
  email: string;
  address: string;
  birth_date: string | null;
  notes: string;
  status: CustomerStatus;
  registered_at: string;
}

export type CustomerInput = Omit<Customer, "id" | "full_name" | "registered_at">;

export interface CustomerHistory {
  id: string;
  full_name: string;
  status: CustomerStatus;
  registered_at: string;
  appointments: unknown[];
  payments: Payment[];
  documents: unknown[];
  notes_log: unknown[];
}
