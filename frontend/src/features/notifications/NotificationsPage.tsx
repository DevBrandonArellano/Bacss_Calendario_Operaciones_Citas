import { useEffect, useState } from "react";

import { eventLabel, statusLabel } from "@/features/notifications/labels";
import { listNotifications, markNotificationRead } from "@/features/notifications/api";
import type { Notification } from "@/types/notification";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function fetchNotifications() {
    setLoading(true);
    setError(null);
    try {
      const data = await listNotifications({ page });
      setNotifications(data.results);
      setCount(data.count);
    } catch {
      setError("No se pudo cargar el centro de notificaciones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function handleMarkAsRead(notification: Notification) {
    setMarkingId(notification.id);
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch {
      setError("No se pudo marcar la notificación como leída.");
    } finally {
      setMarkingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));
  const unreadCount = notifications.filter((item) => item.status !== "read").length;

  return (
    <div>
      <div className="toolbar">
        <h1>Notificaciones</h1>
        {unreadCount > 0 && (
          <span className="badge badge-unread" aria-label={`${unreadCount} notificaciones sin leer`}>
            {unreadCount} sin leer
          </span>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p>Cargando...</p>}

      {!loading && notifications.length === 0 && <p>No tienes notificaciones todavía.</p>}

      {!loading && notifications.length > 0 && (
        <ul className="notification-list">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={
                notification.status === "read"
                  ? "notification-item"
                  : "notification-item notification-item-unread"
              }
            >
              <div className="notification-item-header">
                <span className="notification-item-event">{eventLabel(notification.event_code)}</span>
                <span className={`badge badge-status-${notification.status}`}>
                  {statusLabel(notification.status)}
                </span>
              </div>
              {notification.subject && (
                <p className="notification-item-subject">{notification.subject}</p>
              )}
              {notification.body && <p className="notification-item-body">{notification.body}</p>}
              <div className="notification-item-footer">
                <time dateTime={notification.created_at}>{formatDateTime(notification.created_at)}</time>
                {notification.status !== "read" && (
                  <button
                    type="button"
                    onClick={() => handleMarkAsRead(notification)}
                    disabled={markingId === notification.id}
                    aria-label={`Marcar como leída: ${eventLabel(notification.event_code)}`}
                  >
                    Marcar como leída
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </button>
        <span>
          Página {page} de {totalPages}
        </span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
