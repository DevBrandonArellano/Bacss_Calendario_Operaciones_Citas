import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { DashboardPage } from "@/features/reports/DashboardPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

function mockReportsApi(withFinancial: boolean) {
  vi.mocked(apiClient.get).mockImplementation((url: string, config?: { params?: { metric?: string } }) => {
    if (url === "/reports/dashboard/") {
      return Promise.resolve({
        data: {
          today_total: 4,
          today_by_status: { confirmed: 3, cancelled: 1 },
          upcoming_7_days: 10,
          ...(withFinancial ? { new_customers_this_month: 2, revenue_this_month: "150.00" } : {}),
        },
      });
    }
    if (url === "/reports/charts/") {
      const metric = config?.params?.metric;
      if (metric === "appointments") {
        return Promise.resolve({
          data: { metric, group_by: "day", data: [{ period: "2026-01-01", count: 4 }] },
        });
      }
      if (metric === "top_services") {
        return Promise.resolve({
          data: { metric, group_by: "day", data: [{ service_id: "s1", service_name: "Corte", count: 4 }] },
        });
      }
      if (metric === "revenue") {
        return Promise.resolve({
          data: { metric, group_by: "day", data: [{ period: "2026-01-01", total: "150.00" }] },
        });
      }
    }
    return Promise.resolve({ data: {} });
  });
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra las tarjetas y gráficos con permiso financiero", async () => {
    mockReportsApi(true);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Citas hoy")).toBeInTheDocument());
    expect(screen.getByText("Ingresos (mes)")).toBeInTheDocument();
    expect(screen.getAllByText("150.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Corte")).toBeInTheDocument();
  });

  it("no muestra tarjetas financieras sin el permiso", async () => {
    mockReportsApi(false);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Citas hoy")).toBeInTheDocument());
    expect(screen.queryByText("Ingresos (mes)")).not.toBeInTheDocument();
  });
});
