import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { AxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient } from "@/api/client";
import { BookAppointmentPage } from "@/features/appointments/BookAppointmentPage";
import { nowInTimeZone } from "@/lib/businessTime";
import { renderWithApp } from "@/test-support/renderWithApp";

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
const PERMISSIONS = ["appointments:write", "customers:write"];

const BRANCHES = [{ id: "b1", name: "Sucursal Norte", is_active: true }];
const SERVICES = [
  { id: "s1", name: "Corte", category: "", duration_minutes: 30, price: "10.00", status: "active", branches: [] },
  { id: "s2", name: "Tinte", category: "", duration_minutes: 60, price: "35.00", status: "active", branches: [] },
];
const EMPLOYEES = [
  { id: "e1", full_name: "Ana Prof", specialty: "Estilista", branch: "b1", is_active: true, services: ["s1", "s2"] },
  { id: "e2", full_name: "Luis Prof", specialty: "Barbero", branch: "b1", is_active: true, services: ["s1"] },
];
const CUSTOMERS = [{ id: "c1", full_name: "María Pérez", document_number: "0912345678", phone: "0991234567" }];
const SLOTS = [
  { employee_id: "e1", start_time: "10:00:00", end_time: "10:30:00" },
  { employee_id: "e1", start_time: "10:15:00", end_time: "10:45:00" },
  { employee_id: "e2", start_time: "10:00:00", end_time: "10:30:00" },
];

function page<T>(results: T[]) {
  return { data: { count: results.length, next: null, previous: null, results } };
}

function mockApi() {
  vi.mocked(apiClient.get).mockImplementation((url: string, config?: AxiosRequestConfig) => {
    const params = (config?.params ?? {}) as Record<string, string>;
    if (url === "/branches/") return Promise.resolve(page(BRANCHES));
    if (url === "/services/") return Promise.resolve(page(SERVICES));
    if (url === "/employees/") return Promise.resolve(page(EMPLOYEES));
    if (url === "/customers/search/") return Promise.resolve(page(CUSTOMERS));
    if (url === "/availability/") {
      const slots = params.employee_id ? SLOTS.filter((s) => s.employee_id === params.employee_id) : SLOTS;
      return Promise.resolve({ data: { slots } });
    }
    return Promise.resolve({ data: {} });
  });
}

function availabilityRequests() {
  return vi.mocked(apiClient.get).mock.calls.filter(([url]) => url === "/availability/");
}

async function chooseCustomer() {
  fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "María" } });
  fireEvent.click(await screen.findByRole("button", { name: /María Pérez/ }, { timeout: 2000 }));
}

async function chooseService(name = "Corte (30 min)") {
  await screen.findByRole("option", { name });
  fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: name.startsWith("Corte") ? "s1" : "s2" } });
}

describe("BookAppointmentPage (Nueva cita)", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    mockApi();
  });

  it("organiza el formulario en grupos y muestra el resumen con la zona horaria del negocio", async () => {
    renderWithApp(<BookAppointmentPage />, { permissions: PERMISSIONS });

    expect(screen.getByRole("heading", { level: 1, name: "Nueva cita" })).toBeInTheDocument();
    for (const title of ["1. Cliente", "2. Servicio", "3. Profesional", "4. Fecha y horario", "5. Información adicional"]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    expect(screen.getByText(/zona horaria del negocio \(America\/Guayaquil\)/)).toBeInTheDocument();
  });

  it("al guardar vacío muestra qué falta, junto a cada campo, sin llamar al servidor", async () => {
    renderWithApp(<BookAppointmentPage />, { permissions: PERMISSIONS });

    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    expect(await screen.findByText("Selecciona un cliente de la lista.")).toBeInTheDocument();
    expect(screen.getByText("Selecciona un servicio.")).toBeInTheDocument();
    expect(screen.getByText("Elige un horario disponible.")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("la sucursal única se selecciona sola y solo se ofrecen los profesionales del servicio", async () => {
    renderWithApp(<BookAppointmentPage />, { permissions: PERMISSIONS });
    await chooseService("Tinte (60 min)");

    await waitFor(() => expect(screen.getByLabelText("Sucursal")).toHaveValue("b1"));
    // Luis no ofrece "Tinte".
    expect(screen.getByRole("option", { name: /Ana Prof/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Luis Prof/ })).not.toBeInTheDocument();
  });

  it("flujo completo: cliente, servicio, horario y guardado con el payload correcto", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: "new-1" } });
    renderWithApp(<BookAppointmentPage />, { permissions: PERMISSIONS, route: `/citas/nueva?date=${TODAY}` });

    await chooseCustomer();
    await chooseService();
    fireEvent.click(await screen.findByRole("button", { name: "10:15" }));
    fireEvent.change(screen.getByLabelText("Notas internas (opcional)"), { target: { value: "Primera visita" } });
    fireEvent.change(screen.getByLabelText("Estado inicial de la cita"), { target: { value: "pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    expect(apiClient.post).toHaveBeenCalledWith("/appointments/", {
      customer_id: "c1",
      service_id: "s1",
      employee_id: "e1",
      branch_id: "b1",
      appointment_date: TODAY,
      start_time: "10:15:00",
      notes: "Primera visita",
      booking_channel: "staff",
      requires_confirmation: true,
    });
  });

  it("precarga fecha, hora y profesional recibidos desde la Agenda", async () => {
    renderWithApp(<BookAppointmentPage />, {
      permissions: PERMISSIONS,
      route: `/citas/nueva?date=${TODAY}&time=10:00&employee=e2`,
    });

    await chooseService();

    const slot = await screen.findByRole("button", { name: "10:00" });
    await waitFor(() => expect(slot).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByLabelText("Profesional")).toHaveValue("e2");
    expect(screen.getAllByText("Luis Prof").length).toBeGreaterThan(0);
  });

  it("identifica los horarios ocupados entre los disponibles", async () => {
    renderWithApp(<BookAppointmentPage />, { permissions: PERMISSIONS, route: `/citas/nueva?date=${TODAY}&employee=e1` });
    await chooseService();

    // Ana tiene libres 10:00 y 10:15, pero Luis (10:00) no se mezcla: se pidió solo a Ana.
    expect(await screen.findByRole("button", { name: "10:00" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "10:15" })).toBeEnabled();
    expect(screen.getByText(/ocupados o fuera del horario laboral/)).toBeInTheDocument();
  });

  it("si el horario fue tomado por otra persona (409) conserva los datos, avisa y recarga la disponibilidad", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new ApiError({ code: "conflict", message: "El horario seleccionado ya no está disponible.", details: {}, request_id: "r" }, 409)
    );
    renderWithApp(<BookAppointmentPage />, { permissions: PERMISSIONS, route: `/citas/nueva?date=${TODAY}` });
    await chooseCustomer();
    await chooseService();
    fireEvent.click(await screen.findByRole("button", { name: "10:15" }));
    fireEvent.change(screen.getByLabelText("Notas internas (opcional)"), { target: { value: "No perder esto" } });
    const requestsBefore = availabilityRequests().length;

    fireEvent.click(screen.getByRole("button", { name: "Guardar cita" }));

    expect(await screen.findByText("El horario seleccionado ya no está disponible.")).toBeInTheDocument();
    expect(screen.getByLabelText("Notas internas (opcional)")).toHaveValue("No perder esto");
    expect(screen.getAllByText("María Pérez").length).toBeGreaterThan(0);
    await waitFor(() => expect(availabilityRequests().length).toBeGreaterThan(requestsBefore));
  });

  it("evita envíos duplicados mientras se guarda", async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(apiClient.post).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderWithApp(<BookAppointmentPage />, { permissions: PERMISSIONS, route: `/citas/nueva?date=${TODAY}` });
    await chooseCustomer();
    await chooseService();
    fireEvent.click(await screen.findByRole("button", { name: "10:15" }));

    const submit = screen.getByRole("button", { name: "Guardar cita" });
    fireEvent.click(submit);
    fireEvent.click(screen.getByRole("button", { name: "Guardando..." }));

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
    finish({ data: { id: "x" } });
  });

  it("sin permiso para registrar clientes no ofrece el enlace de alta", async () => {
    renderWithApp(<BookAppointmentPage />, { permissions: ["appointments:write"] });

    expect(screen.queryByText(/Regístralo en otra pestaña/)).not.toBeInTheDocument();
  });
});
