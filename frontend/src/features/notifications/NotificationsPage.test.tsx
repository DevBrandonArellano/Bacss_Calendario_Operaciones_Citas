import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const UNREAD_NOTIFICATION = {
  id: "1",
  channel: "internal",
  event_code: "appointment.confirmed",
  status: "sent",
  subject: "Tu cita quedó confirmada",
  body: "Detalle: servicio de corte a las 10:00.",
  payload: {},
  sent_at: "2026-01-01T10:00:00Z",
  read_at: null,
  created_at: "2026-01-01T10:00:00Z",
};

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("muestra las notificaciones devueltas por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 1, next: null, previous: null, results: [UNREAD_NOTIFICATION] },
    });

    render(<NotificationsPage />);

    await waitFor(() => expect(screen.getByText("Cita confirmada")).toBeInTheDocument());
    expect(screen.getByText("1 sin leer")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay notificaciones", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(<NotificationsPage />);

    await waitFor(() =>
      expect(screen.getByText("No tienes notificaciones todavía.")).toBeInTheDocument()
    );
  });

  it("marca una notificación como leída al hacer clic", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 1, next: null, previous: null, results: [UNREAD_NOTIFICATION] },
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { ...UNREAD_NOTIFICATION, status: "read", read_at: "2026-01-01T10:05:00Z" },
    });

    render(<NotificationsPage />);

    const markButton = await screen.findByRole("button", {
      name: "Marcar como leída: Cita confirmada",
    });
    fireEvent.click(markButton);

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/notifications/1/read/"));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Marcar como leída: Cita confirmada" })
      ).not.toBeInTheDocument()
    );
  });
});
