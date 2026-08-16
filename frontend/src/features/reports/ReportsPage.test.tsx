import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ReportsPage } from "@/features/reports/ReportsPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    getAccess: () => "fake-access-token",
    getRefresh: () => "fake-refresh-token",
    set: vi.fn(),
    setAccess: vi.fn(),
    clear: vi.fn(),
  },
}));

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra el reporte general con la tasa de cancelación", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === "/reports/summary/") {
        return Promise.resolve({
          data: {
            date_from: "2026-01-01",
            date_to: "2026-01-31",
            appointments: { total: 10, by_status: { completed: 8, cancelled: 2 } },
            cancellations: { cancelled: 2, no_show: 0, rate: 0.2 },
          },
        });
      }
      return Promise.resolve({ data: { id: "org-1", name: "Org", modules: [] } });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Citas totales")).toBeInTheDocument());
    expect(screen.getByText("20%")).toBeInTheDocument();
  });
});
