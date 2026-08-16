import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { ServiceListPage } from "@/features/services/ServiceListPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("ServiceListPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra los servicios devueltos por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "1",
            name: "Cambio de aceite",
            category: "Mantenimiento",
            duration_minutes: 45,
            price: "25.00",
            status: "active",
            branches: [],
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <ServiceListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Cambio de aceite")).toBeInTheDocument());
    expect(screen.getByText("45 min")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay servicios", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(
      <MemoryRouter>
        <ServiceListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("No se encontraron servicios.")).toBeInTheDocument());
  });
});
