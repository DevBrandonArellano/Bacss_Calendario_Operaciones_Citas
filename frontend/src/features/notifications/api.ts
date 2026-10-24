import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Notification } from "@/types/notification";

export interface NotificationListParams {
  page?: number;
}

export async function listNotifications(
  params: NotificationListParams = {}
): Promise<Paginated<Notification>> {
  const response = await apiClient.get<Paginated<Notification>>("/notifications/", { params });
  return response.data;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const response = await apiClient.post<Notification>(`/notifications/${id}/read/`);
  return response.data;
}

/** Cantidad de notificaciones sin leer del usuario en sesión (pide 1 resultado y usa `count`). */
export async function countUnreadNotifications(): Promise<number> {
  const response = await apiClient.get<Paginated<Notification>>("/notifications/", {
    params: { unread: "true", page_size: 1 },
  });
  return response.data.count;
}
