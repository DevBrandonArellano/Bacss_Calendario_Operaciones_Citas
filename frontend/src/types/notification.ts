export type NotificationChannel = "email" | "sms" | "whatsapp" | "internal";
export type NotificationStatus = "queued" | "sent" | "failed" | "read";

export interface Notification {
  id: string;
  channel: NotificationChannel;
  event_code: string;
  status: NotificationStatus;
  subject: string;
  body: string;
  payload: Record<string, unknown>;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}
