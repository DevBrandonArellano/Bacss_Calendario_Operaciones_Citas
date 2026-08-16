import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { WorkOrderDetailPage } from "@/features/moto/WorkOrderDetailPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const WORK_ORDER = {
  id: "wo-1",
  motorcycle: "moto-1",
  appointment: null,
  status: "received",
  total: "0.00",
  diagnosis_notes: "",
  received_at: "2026-01-01T10:00:00Z",
  delivered_at: null,
  items: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/ordenes-trabajo/wo-1"]}>
      <Routes>
        <Route path="/ordenes-trabajo/:id" element={<WorkOrderDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkOrderDetailPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("muestra la orden y el botón para la siguiente transición válida", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: WORK_ORDER });

    renderPage();

    await waitFor(() => expect(screen.getByText("Recibida")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Pasar a: En diagnóstico" })).toBeInTheDocument();
  });

  it("cambia de estado al hacer clic en la transición", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: WORK_ORDER })
      .mockResolvedValueOnce({ data: { ...WORK_ORDER, status: "diagnosis" } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { ...WORK_ORDER, status: "diagnosis" } });

    renderPage();

    const transitionButton = await screen.findByRole("button", { name: "Pasar a: En diagnóstico" });
    fireEvent.click(transitionButton);

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/modules/moto/work-orders/wo-1/transition/", {
        status: "diagnosis",
      })
    );
  });

  it("agrega un ítem y recarga la orden", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: WORK_ORDER })
      .mockResolvedValueOnce({
        data: {
          ...WORK_ORDER,
          total: "15.00",
          items: [
            {
              id: "item-1",
              item_type: "part",
              description: "Filtro",
              quantity: 1,
              unit_price: "15.00",
              subtotal: "15.00",
            },
          ],
        },
      });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { id: "item-1", item_type: "part", description: "Filtro", quantity: 1, unit_price: "15.00", subtotal: "15.00" },
    });

    renderPage();

    await screen.findByText("Sin ítems registrados todavía.");
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Filtro" } });
    fireEvent.change(screen.getByLabelText("Precio unitario"), { target: { value: "15.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar ítem" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/modules/moto/work-orders/wo-1/items/", {
        item_type: "part",
        description: "Filtro",
        quantity: 1,
        unit_price: "15.00",
      })
    );
    await waitFor(() => expect(screen.getByText("Filtro")).toBeInTheDocument());
  });
});
