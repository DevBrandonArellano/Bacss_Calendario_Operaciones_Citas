import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { ProductListPage } from "@/features/store/ProductListPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("ProductListPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra los productos devueltos por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "1",
            sku: "CAM-001",
            name: "Camiseta",
            description: "",
            category: "Ropa",
            price: "20.00",
            cost: "10.00",
            stock: 5,
            min_stock: 2,
            status: "active",
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ProductListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("CAM-001")).toBeInTheDocument());
    expect(screen.getByText("Camiseta")).toBeInTheDocument();
  });

  it("marca el stock bajo cuando stock <= min_stock", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "1",
            sku: "GOR-001",
            name: "Gorra",
            description: "",
            category: "",
            price: "12.00",
            cost: "5.00",
            stock: 1,
            min_stock: 3,
            status: "active",
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ProductListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Stock bajo")).toBeInTheDocument());
  });

  it("muestra un mensaje cuando no hay productos", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(
      <MemoryRouter>
        <ProductListPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText("No hay productos registrados todavía.")).toBeInTheDocument()
    );
  });
});
