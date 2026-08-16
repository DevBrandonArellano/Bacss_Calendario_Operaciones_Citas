import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { MotorcycleListPage } from "@/features/moto/MotorcycleListPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("MotorcycleListPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra las motos devueltas por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "1",
            customer: "cust-1",
            plate: "ABC-123",
            brand: "Yamaha",
            model: "FZ",
            year: 2022,
            color: "",
            vin: "",
            engine_number: "",
            mileage: 5000,
            purchase_date: null,
            notes: "",
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <MotorcycleListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("ABC-123")).toBeInTheDocument());
    expect(screen.getByText("Yamaha FZ")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay motos", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(
      <MemoryRouter>
        <MotorcycleListPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText("No hay motos registradas todavía.")).toBeInTheDocument()
    );
  });
});
