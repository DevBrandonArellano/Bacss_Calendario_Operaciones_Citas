import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { CalendarPage } from "@/features/appointments/CalendarPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

function emptyPage() {
  return { data: { count: 0, next: null, previous: null, results: [] } };
}

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra las citas de la semana agrupadas por fecha", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === "/employees/") return Promise.resolve(emptyPage());
      if (url === "/services/") return Promise.resolve(emptyPage());
      if (url === "/customers/") return Promise.resolve(emptyPage());
      if (url === "/appointments/") {
        return Promise.resolve({
          data: {
            count: 1,
            next: null,
            previous: null,
            results: [
              {
                id: "1",
                branch: "b1",
                customer: "c1",
                service: "s1",
                employee: "e1",
                appointment_date: "2026-08-17",
                start_time: "10:00:00",
                end_time: "10:30:00",
                duration_minutes: 30,
                status: "confirmed",
                notes: "",
                price: "10.00",
                payment_status: "unpaid",
                booking_channel: "staff",
              },
            ],
          },
        });
      }
      return Promise.resolve(emptyPage());
    });

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("10:00–10:30")).toBeInTheDocument());
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay citas en el rango", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(emptyPage());

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("No hay citas en este rango.")).toBeInTheDocument());
  });

  it("marca la vista seleccionada con aria-pressed sin sacarla del orden de tabulación", async () => {
    vi.mocked(apiClient.get).mockResolvedValue(emptyPage());

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("No hay citas en este rango.")).toBeInTheDocument());

    const weekButton = screen.getByRole("button", { name: "Semana" });
    expect(weekButton).toHaveAttribute("aria-pressed", "true");
    expect(weekButton).not.toBeDisabled();

    const monthButton = screen.getByRole("button", { name: "Mes" });
    expect(monthButton).toHaveAttribute("aria-pressed", "false");
  });
});
