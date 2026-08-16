import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { PaymentsPage } from "@/features/payments/PaymentsPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] };

const CUSTOMER = {
  id: "cust-1",
  branch: null,
  first_name: "Ana",
  last_name: "Pérez",
  full_name: "Ana Pérez",
  document_type: "",
  document_number: "0102030405",
  phone: "0999999999",
  email: "ana@test.com",
  address: "",
  birth_date: null,
  notes: "",
  status: "active",
  registered_at: "2026-01-01T00:00:00Z",
};

const PAYMENT = {
  id: "pay-1",
  appointment: null,
  appointment_date: null,
  customer: "cust-1",
  customer_name: "Ana Pérez",
  amount: "25.00",
  method: "cash",
  status: "paid",
  paid_at: "2026-01-01T10:00:00Z",
  refunded_at: null,
  notes: "",
  created_at: "2026-01-01T10:00:00Z",
};

function mockGetByUrl(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: unknown) => {
    const path = String(url);
    if (path in overrides) return Promise.resolve({ data: overrides[path] });
    return Promise.resolve({ data: EMPTY_PAGE });
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PaymentsPage />
    </MemoryRouter>
  );
}

describe("PaymentsPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("muestra los pagos devueltos por la API", async () => {
    mockGetByUrl({ "/payments/": { count: 1, next: null, previous: null, results: [PAYMENT] } });

    renderPage();

    await waitFor(() => expect(screen.getByText("Ana Pérez")).toBeInTheDocument());
    expect(screen.getByText("25.00")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay pagos", async () => {
    mockGetByUrl();

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("No hay pagos registrados todavía.")).toBeInTheDocument()
    );
  });

  it("busca un cliente, lo selecciona y registra un pago", async () => {
    mockGetByUrl({
      "/customers/search/": { count: 1, next: null, previous: null, results: [CUSTOMER] },
      "/appointments/": EMPTY_PAGE,
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: PAYMENT });

    renderPage();

    const searchInput = screen.getByLabelText("Buscar cliente para registrar pago");
    fireEvent.change(searchInput, { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    const customerButton = await screen.findByRole("button", { name: /Ana Pérez/ });
    fireEvent.click(customerButton);

    await screen.findByText("Ana Pérez");
    const amountInput = screen.getByLabelText("Monto");
    fireEvent.change(amountInput, { target: { value: "25.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/payments/", {
        customer_id: "cust-1",
        appointment_id: null,
        amount: "25.00",
        method: "cash",
      })
    );
  });

  it("reembolsa un pago existente", async () => {
    mockGetByUrl({ "/payments/": { count: 1, next: null, previous: null, results: [PAYMENT] } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { ...PAYMENT, status: "refunded" } });

    renderPage();

    const refundButton = await screen.findByRole("button", { name: "Reembolsar" });
    fireEvent.click(refundButton);

    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/payments/pay-1/refund/", {}));
  });
});
