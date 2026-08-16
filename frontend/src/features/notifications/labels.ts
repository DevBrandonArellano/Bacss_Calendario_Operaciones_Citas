import type { NotificationStatus } from "@/types/notification";

const EVENT_LABELS: Record<string, string> = {
  "appointment.created": "Cita creada",
  "appointment.confirmed": "Cita confirmada",
  "appointment.cancelled": "Cita cancelada",
  "appointment.rescheduled": "Cita reprogramada",
};

const REMINDER_EVENT_PATTERN = /^appointment\.reminder\.\d+h$/;

export function eventLabel(eventCode: string): string {
  if (REMINDER_EVENT_PATTERN.test(eventCode)) return "Recordatorio de cita";
  return EVENT_LABELS[eventCode] ?? eventCode;
}

const STATUS_LABELS: Record<NotificationStatus, string> = {
  queued: "En cola",
  sent: "Enviada",
  failed: "Fallida",
  read: "Leída",
};

export function statusLabel(status: NotificationStatus): string {
  return STATUS_LABELS[status];
}
