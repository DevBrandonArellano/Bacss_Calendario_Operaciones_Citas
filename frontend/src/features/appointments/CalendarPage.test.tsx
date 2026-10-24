import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useNavigate } from "react-router-dom";
import type { AxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient } from "@/api/client";
import { CalendarPage } from "@/features/appointments/CalendarPage";
import { nowInTimeZone } from "@/lib/businessTime";
import { renderWithApp } from "@/test-support/renderWithApp";
import type { Appointment } from "@/types/appointment";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {
    status?: number;
    constructor(body: { message: string }, status?: number) {
      super(body.message);
      this.status = status;
    }
  },
}));

const TODAY = nowInTimeZone("America/Guayaquil").date;
const WRITE = ["appointments:write", "appointments:read", "customers:read", "services:read"];

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    branch: "b1",
    branch_name: "Sucursal Norte",
    customer: "c1",
    customer_name: "María Pérez",
    service: "s1",
    service_name: "Corte",
    employee: "e1",
    employee_name: "Ana Prof",
    appointment_date: TODAY,
    start_time: "10:00:00",
    end_time: "10:30:00",
    duration_minutes: 30,
    status: "pending",
    notes: "",
    price: "10.00",
    payment_status: "unpaid",
    booking_channel: "staff",
    ...overrides,
  };
}

const EMPLOYEES = [
  { id: "e1", full_name: "Ana Prof", specialty: "Estilista", branch: "b1", is_active: true, services: ["s1"] },
  { id: "e2", full_name: "Luis Prof", specialty: "Barbero", branch: "b1", is_active: true, services: ["s1"] },
];
const SERVICES = [{ id: "s1", name: "Corte", duration_minutes: 30, price: "10.00", status: "active", branches: [] }];
const SCHEDULES = [{ id: "sc1", branch: "b1", employee: null, weekday: 0, start_time: "09:00:00", end_time: "17:00:00", is_break: false }];

function page<T>(results: T[], next: string | null = null) {
  return { data: { count: results.length, next, previous: null, results } };
}

interface Scenario {
  appointments?: Appointment[];
  secondPage?: Appointment[];
  appointmentsError?: unknown;
  schedules?: unknown[];
}

function mockApi({ appointments = [appointment()], secondPage, appointmentsError, schedules = SCHEDULES }: Scenario = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string, config?: AxiosRequestConfig) => {
    const params = (config?.params ?? {}) as Record<string, unknown>;
    if (url === "/appointments/") {
      if (appointmentsError) return Promise.reject(appointmentsError);
      if (secondPage && params.page === 1) return Promise.resolve(page(appointments, "next-page"));
      if (secondPage && params.page === 2) return Promise.resolve(page(secondPage));
      return Promise.resolve(page(appointments));
    }
    if (url === "/employees/") return Promise.resolve(page(EMPLOYEES));
    if (url === "/services/") return Promise.resolve(page(SERVICES));
    if (url === "/schedules/") return Promise.resolve(page(schedules));
    return Promise.resolve({ data: {} });
  });
}

type GetCall = [string, { params: Record<string, string | number | undefined> }];

function apiError(message: string, status: number) {
  return new ApiError({ code: "error", message, details: {}, request_id: "r1" }, status);
}

function appointmentRequests(): GetCall[] {
  return (vi.mocked(apiClient.get).mock.calls as unknown as GetCall[]).filter(([url]) => url === "/appointments/");
}

function lastAppointmentRequest(): GetCall[1] {
  const requests = appointmentRequests();
  return requests[requests.length - 1][1];
}

const WEEK = `/citas?view=week&date=${TODAY}`;

describe("CalendarPage (Agenda)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });

  it("muestra el título, la acción principal y las citas del período como bloques accesibles", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });

    expect(screen.getByRole("heading", { level: 1, name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nueva cita/ })).toBeInTheDocument();
    const block = await screen.findByRole("button", { name: /María Pérez/ });
    expect(block).toHaveAccessibleName(/10:00 a 10:30.*Corte.*Ana Prof.*Pendiente/);
  });

  it("carga todas las páginas del rango, no solo los primeros 20 registros", async () => {
    mockApi({ appointments: [appointment()], secondPage: [appointment({ id: "a2", customer_name: "Pedro Gómez", start_time: "11:00:00", end_time: "11:30:00" })] });
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });

    expect(await screen.findByRole("button", { name: /Pedro Gómez/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /María Pérez/ })).toBeInTheDocument();
    expect(appointmentRequests().map(([, config]) => config.params.page)).toEqual([1, 2]);
    expect(appointmentRequests()[0][1].params.page_size).toBe(100);
  });

  it("al cambiar a la vista mensual pide el rango del mes y marca la vista activa", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });
    await screen.findByRole("button", { name: /María Pérez/ });

    fireEvent.click(screen.getByRole("button", { name: "Mes" }));

    await waitFor(() => {
      const last = lastAppointmentRequest().params;
      expect(String(last.appointment_date__gte).endsWith("-01")).toBe(true);
    });
    expect(screen.getByRole("button", { name: "Mes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "false");
  });

  it("la vista diaria muestra una columna por profesional", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: `/citas?view=day&date=${TODAY}`, permissions: WRITE });

    expect(await screen.findByText("Ana Prof")).toBeInTheDocument();
    expect(screen.getByText("Luis Prof")).toBeInTheDocument();
  });

  it("al navegar al período siguiente cambia el rango consultado", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });
    await screen.findByRole("button", { name: /María Pérez/ });
    const first = appointmentRequests()[0][1].params.appointment_date__gte as string;

    fireEvent.click(screen.getByRole("button", { name: "Período siguiente" }));

    await waitFor(() => expect(String(lastAppointmentRequest().params.appointment_date__gte) > first).toBe(true));
  });

  it("abrir una cita muestra el panel de detalle con sus datos y las acciones de su estado", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });

    fireEvent.click(await screen.findByRole("button", { name: /María Pérez/ }));

    const drawer = await screen.findByRole("dialog", { name: "Detalle de la cita" });
    expect(within(drawer).getByText("María Pérez")).toBeInTheDocument();
    expect(within(drawer).getByText(/Sucursal Norte/)).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument();
    // Una cita pendiente no se puede reprogramar (el backend respondería 409).
    expect(within(drawer).queryByRole("button", { name: "Reprogramar" })).not.toBeInTheDocument();
  });

  it("confirmar una cita llama al backend, refresca la agenda y avisa del resultado", async () => {
    mockApi();
    vi.mocked(apiClient.post).mockResolvedValue({ data: appointment({ status: "confirmed" }) });
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });
    fireEvent.click(await screen.findByRole("button", { name: /María Pérez/ }));
    const before = appointmentRequests().length;

    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Cita confirmada.")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith("/appointments/a1/confirm/");
    await waitFor(() => expect(appointmentRequests().length).toBeGreaterThan(before));
  });

  it("cancelar pide confirmación con resumen y motivo, y envía el motivo", async () => {
    mockApi();
    vi.mocked(apiClient.post).mockResolvedValue({ data: appointment({ status: "cancelled" }) });
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });
    fireEvent.click(await screen.findByRole("button", { name: /María Pérez/ }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar cita" }));

    const dialog = await screen.findByRole("dialog", { name: "Cancelar cita" });
    expect(within(dialog).getByText("María Pérez")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Motivo (opcional)"), { target: { value: "El cliente avisó" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar cita" }));

    expect(await screen.findByText("Cita cancelada.")).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith("/appointments/a1/cancel/", { reason: "El cliente avisó" });
  });

  it("un error del servidor al ejecutar una acción se muestra sin ocultar la cita", async () => {
    mockApi();
    const error = apiError("Esa cita ya no se puede confirmar.", 409);
    vi.mocked(apiClient.post).mockRejectedValue(error);
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });
    fireEvent.click(await screen.findByRole("button", { name: /María Pérez/ }));

    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Esa cita ya no se puede confirmar.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Detalle de la cita" })).toBeInTheDocument();
  });

  it("editar las notas envía solo las notas", async () => {
    mockApi();
    vi.mocked(apiClient.patch).mockResolvedValue({ data: appointment({ notes: "Trae casco" }) });
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });
    fireEvent.click(await screen.findByRole("button", { name: /María Pérez/ }));
    const drawer = await screen.findByRole("dialog");

    fireEvent.change(within(drawer).getByLabelText("Notas internas de la cita"), { target: { value: "Trae casco" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Guardar notas" }));

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/appointments/a1/notes/", { notes: "Trae casco" }));
  });

  it("sin permiso de escritura no hay 'Nueva cita' ni acciones sobre la cita", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: ["appointments:read"] });

    fireEvent.click(await screen.findByRole("button", { name: /María Pérez/ }));
    const drawer = await screen.findByRole("dialog");

    expect(screen.queryByRole("link", { name: /Nueva cita/ })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Guardar notas" })).not.toBeInTheDocument();
  });

  it("período sin citas: estado vacío con acciones, y la rejilla sigue disponible", async () => {
    mockApi({ appointments: [] });
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });

    expect(await screen.findByText("No hay citas en este período")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Nueva cita/ }).length).toBeGreaterThan(1);
  });

  it("filtros sin resultados: mensaje distinto y 'Limpiar filtros' restablece la consulta", async () => {
    mockApi({ appointments: [] });
    renderWithApp(<CalendarPage />, { route: `${WEEK}&status=cancelled`, permissions: WRITE });

    expect(await screen.findByText("Ninguna cita coincide con los filtros")).toBeInTheDocument();
    expect(screen.queryByText("No hay citas en este período")).not.toBeInTheDocument();
    expect(screen.getByText("Estado: Cancelada")).toBeInTheDocument();
    expect(appointmentRequests()[0][1].params.status__in).toBe("cancelled");

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(await screen.findByText("No hay citas en este período")).toBeInTheDocument();
    expect(lastAppointmentRequest().params.status__in).toBeUndefined();
  });

  it("un error de red no se presenta como agenda vacía y permite reintentar", async () => {
    mockApi({ appointmentsError: new Error("Network Error") });
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });

    expect(await screen.findByText("No se pudo cargar la agenda")).toBeInTheDocument();
    expect(screen.queryByText("No hay citas en este período")).not.toBeInTheDocument();

    mockApi();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: /María Pérez/ })).toBeInTheDocument();
  });

  it("un 403 muestra un mensaje de permisos, no de agenda vacía", async () => {
    mockApi({ appointmentsError: apiError("Prohibido", 403) });
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });

    expect(await screen.findByText("No tienes permiso para ver la agenda")).toBeInTheDocument();
  });

  it("avisa cuando no hay horarios de trabajo configurados", async () => {
    mockApi({ schedules: [] });
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });

    expect(await screen.findByText("No hay horarios de trabajo configurados.")).toBeInTheDocument();
  });

  it("la vista 'Por profesional' elige el primer profesional y filtra la consulta", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: `/citas?view=professional&date=${TODAY}`, permissions: WRITE });

    await waitFor(() => expect(lastAppointmentRequest().params.employee).toBe("e1"));
  });

  it("un enlace con ?appointment= abre directamente el detalle de esa cita", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: `/citas?view=day&date=${TODAY}&appointment=a1`, permissions: WRITE });

    expect(await screen.findByRole("dialog", { name: "Detalle de la cita" })).toBeInTheDocument();
  });

  it("cerrar el panel con Escape lo cierra", async () => {
    mockApi();
    renderWithApp(<CalendarPage />, { route: WEEK, permissions: WRITE });
    fireEvent.click(await screen.findByRole("button", { name: /María Pérez/ }));
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("al navegar dentro de la Agenda a otra fecha con una cita abierta, el panel no se cierra por datos antiguos", async () => {
    // Regresión: el efecto «cerrar si la cita no está en la lista» corría con la lista del período anterior.
    const NEXT_DAY = "2099-03-02";
    vi.mocked(apiClient.get).mockImplementation((url: string, config?: AxiosRequestConfig) => {
      const params = (config?.params ?? {}) as Record<string, unknown>;
      if (url === "/appointments/") {
        const target = String(params.appointment_date__gte) <= NEXT_DAY && String(params.appointment_date__lte) >= NEXT_DAY;
        return Promise.resolve(
          page(target ? [appointment({ id: "a2", customer_name: "Pedro Gómez", appointment_date: NEXT_DAY })] : [appointment()])
        );
      }
      if (url === "/employees/") return Promise.resolve(page(EMPLOYEES));
      if (url === "/services/") return Promise.resolve(page(SERVICES));
      if (url === "/schedules/") return Promise.resolve(page(SCHEDULES));
      return Promise.resolve({ data: {} });
    });

    function Harness() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate(`/citas?view=day&date=${NEXT_DAY}&appointment=a2`)}>ir a la nueva cita</button>
          <CalendarPage />
        </>
      );
    }
    renderWithApp(<Harness />, { route: WEEK, permissions: WRITE });
    await screen.findByRole("button", { name: /María Pérez/ });

    fireEvent.click(screen.getByRole("button", { name: "ir a la nueva cita" }));

    const drawer = await screen.findByRole("dialog", { name: "Detalle de la cita" });
    expect(within(drawer).getByText("Pedro Gómez")).toBeInTheDocument();
  });
});
