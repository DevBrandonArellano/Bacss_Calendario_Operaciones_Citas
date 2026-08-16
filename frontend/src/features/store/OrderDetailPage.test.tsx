import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { OrderDetailPage } from "@/features/store/OrderDetailPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const ORDER = {
  id: "order-1",
  customer: "cust-1",
  branch: "branch-1",
  status: "pending",
  total: "40.00",
  ordered_at: "2026-01-01T10:00:00Z",
  items: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/tienda/pedidos/order-1"]}>
      <Routes>
        <Route path="/tienda/pedidos/:id" element={<OrderDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OrderDetailPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("muestra el pedido y los botones de transición válidos desde 'pending'", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: ORDER });

    renderPage();

    await waitFor(() => expect(screen.getByText("Pendiente")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Pasar a: Confirmado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pasar a: Cancelado" })).toBeInTheDocument();
  });

  it("cambia de estado al hacer clic en una transición", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: ORDER })
      .mockResolvedValueOnce({ data: { ...ORDER, status: "confirmed" } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { ...ORDER, status: "confirmed" } });

    renderPage();

    const button = await screen.findByRole("button", { name: "Pasar a: Confirmado" });
    fireEvent.click(button);

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/modules/store/orders/order-1/transition/", {
        status: "confirmed",
      })
    );
    await waitFor(() => expect(screen.getByText("Confirmado")).toBeInTheDocument());
  });

  it("muestra que llegó a su estado final cuando está entregado", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...ORDER, status: "delivered" } });

    renderPage();

    await waitFor(() => expect(screen.getByText("Este pedido llegó a su estado final.")).toBeInTheDocument());
  });
});
