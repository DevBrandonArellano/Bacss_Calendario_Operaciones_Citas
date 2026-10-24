import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { AxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { DashboardPage } from "@/features/reports/DashboardPage";
import { nowInTimeZone } from "@/lib/businessTime";
import { renderWithApp } from "@/test-support/renderWithApp";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const TODAY = nowInTimeZone("America/Guayaquil").date;

interface Scenario {
  financial?: boolean;
  summaryFails?: boolean;
  appointmentCounts?: { current: number; previous: number };
  revenue?: { current: string; previous: string };
}

function previousDay(): string {
  const date = new Date(`${TODAY}T00:00:00`);
  date.setDate(date.getDate() - 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function mockApi({ financial = true, summaryFails = false, appointmentCounts = { current: 4, previous: 2 }, revenue }: Scenario = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string, config?: AxiosRequestConfig) => {
    if (url === "/reports/dashboard/") {
      if (summaryFails) return Promise.reject(new Error("500"));
      return Promise.resolve({
        data: {
          today_total: 4,
          today_by_status: { confirmed: 3, pending: 1 },
          upcoming_7_days: 10,
          ...(financial ? { new_customers_this_month: 2, revenue_this_month: "150.00" } : {}),
        },
      });
    }
    if (url === "/reports/charts/") {
      const metric = (config?.params as { metric?: string } | undefined)?.metric;
      if (metric === "appointments") {
        return Promise.resolve({
          data: {
            data: [
              ...(appointmentCounts.current ? [{ period: TODAY, count: appointmentCounts.current }] : []),
              ...(appointmentCounts.previous ? [{ period: previousDay(), count: appointmentCounts.previous }] : []),
            ],
          },
        });
      }
      if (metric === "top_services") {
        return Promise.resolve({
          data: { data: [{ service_id: "s1", service_name: "Corte", count: 3 }, { service_id: "s2", service_name: "Tinte", count: 1 }] },
        });
      }
      if (metric === "revenue") {
        return Promise.resolve({
          data: {
            data: [
              { period: TODAY, total: revenue?.current ?? "150.00" },
              ...(revenue?.previous ? [{ period: previousDay(), total: revenue.previous }] : []),
            ],
          },
        });
      }
      if (metric === "new_customers") {
        return Promise.resolve({ data: { data: [{ period: TODAY, count: 2 }] } });
      }
    }
    if (url === "/appointments/") {
      return Promise.resolve({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: "a1",
              appointment_date: "2099-01-05",
              start_time: "10:30:00",
              end_time: "11:00:00",
              status: "confirmed",
              customer_name: "María Pérez",
              service_name: "Corte",
              employee_name: "Ana Prof",
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
}

type ChartCall = [string, { params: { metric: string; date_from: string } }];

function chartRequests(metric: string): ChartCall[] {
  return (vi.mocked(apiClient.get).mock.calls as unknown as ChartCall[]).filter(
    ([url, config]) => url === "/reports/charts/" && config.params.metric === metric
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra cuatro tarjetas con datos reales cuando hay permiso financiero", async () => {
    mockApi();
    renderWithApp(<DashboardPage />, { permissions: ["appointments:write"] });

    expect(await screen.findByText("Citas de hoy")).toBeInTheDocument();
    expect(screen.getByText("Próximos 7 días")).toBeInTheDocument();
    expect(await screen.findByText("Clientes nuevos")).toBeInTheDocument();
    expect(screen.getByText("Ingresos cobrados")).toBeInTheDocument();
    expect((await screen.findAllByText(/\$\s?150/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/3 confirmadas/)).toBeInTheDocument();
  });

  it("sin permiso financiero no muestra ni consulta cifras de ingresos ni clientes nuevos", async () => {
    mockApi({ financial: false });
    renderWithApp(<DashboardPage />);

    expect(await screen.findByText("Citas del período")).toBeInTheDocument();
    expect(screen.getByText("Completadas hoy")).toBeInTheDocument();
    expect(screen.queryByText("Ingresos cobrados")).not.toBeInTheDocument();
    expect(screen.queryByText("Ingresos por día")).not.toBeInTheDocument();
    await waitFor(() => expect(chartRequests("appointments").length).toBeGreaterThan(0));
    expect(chartRequests("revenue")).toHaveLength(0);
    expect(chartRequests("new_customers")).toHaveLength(0);
  });

  it("calcula la variación frente al período anterior", async () => {
    mockApi({ revenue: { current: "150.00", previous: "100.00" } });
    renderWithApp(<DashboardPage />);

    expect(await screen.findByText("50% más")).toBeInTheDocument();
  });

  it("no inventa una variación cuando el período anterior no tiene datos", async () => {
    mockApi({ revenue: { current: "150.00", previous: "" } });
    renderWithApp(<DashboardPage />);

    const message = await screen.findAllByText("Sin datos del período anterior para comparar.");
    expect(message.length).toBeGreaterThan(0);
  });

  it("al cambiar de período vuelve a pedir los datos con el nuevo rango", async () => {
    mockApi();
    renderWithApp(<DashboardPage />);
    await screen.findByText("Citas de hoy");
    await waitFor(() => expect(chartRequests("appointments")).toHaveLength(1));
    const [, firstConfig] = chartRequests("appointments")[0];

    fireEvent.click(screen.getByRole("button", { name: "Últimos 30 días" }));

    await waitFor(() => expect(chartRequests("appointments")).toHaveLength(2));
    const [, secondConfig] = chartRequests("appointments")[1];
    expect(secondConfig.params.date_from < firstConfig.params.date_from).toBe(true);
    expect(screen.getByRole("button", { name: "Últimos 30 días" })).toHaveAttribute("aria-pressed", "true");
  });

  it("lista las próximas citas con enlace a su detalle en la agenda", async () => {
    mockApi();
    renderWithApp(<DashboardPage />);

    const link = await screen.findByRole("link", { name: "Ver detalle de la cita de María Pérez" });
    expect(link).toHaveAttribute("href", expect.stringContaining("appointment=a1"));
    expect(link).toHaveAttribute("href", expect.stringContaining("date=2099-01-05"));
  });

  it("muestra un estado vacío con acción cuando no hay citas", async () => {
    mockApi({ appointmentCounts: { current: 0, previous: 0 } });
    renderWithApp(<DashboardPage />, { permissions: ["appointments:write"] });

    expect(await screen.findByText("Todavía no hay citas registradas en este período")).toBeInTheDocument();
    const empty = screen.getByText("Todavía no hay citas registradas en este período").closest("div") as HTMLElement;
    expect(within(empty.parentElement as HTMLElement).getByRole("link", { name: /Crear cita/ })).toBeInTheDocument();
  });

  it("un error de red no se confunde con una agenda vacía y permite reintentar", async () => {
    mockApi({ summaryFails: true });
    renderWithApp(<DashboardPage />);

    expect(await screen.findByText("No se pudo cargar el resumen")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no hay citas registradas en este período")).not.toBeInTheDocument();

    mockApi();
    fireEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);
    expect(await screen.findByText("Citas de hoy")).toBeInTheDocument();
  });

  it("las acciones rápidas respetan los permisos del usuario", async () => {
    mockApi();
    renderWithApp(<DashboardPage />, { permissions: ["appointments:read"] });

    expect(await screen.findByRole("link", { name: /Consultar agenda/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Registrar cliente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Gestionar profesionales/ })).not.toBeInTheDocument();
  });
});
