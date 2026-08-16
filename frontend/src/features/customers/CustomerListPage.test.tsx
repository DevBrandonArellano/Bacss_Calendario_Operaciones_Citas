import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { CustomerListPage } from "@/features/customers/CustomerListPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("CustomerListPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra los clientes devueltos por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "1",
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
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <CustomerListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Ana Pérez")).toBeInTheDocument());
    expect(screen.getByText("0102030405")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay clientes", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(
      <MemoryRouter>
        <CustomerListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("No se encontraron clientes.")).toBeInTheDocument());
  });
});
