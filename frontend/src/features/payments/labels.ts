import type { PaymentMethod, PaymentStatus } from "@/types/payment";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  other: "Otro",
};

export function methodLabel(method: PaymentMethod): string {
  return METHOD_LABELS[method];
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  refunded: "Reembolsado",
};

export function paymentStatusLabel(status: PaymentStatus): string {
  return STATUS_LABELS[status];
}
