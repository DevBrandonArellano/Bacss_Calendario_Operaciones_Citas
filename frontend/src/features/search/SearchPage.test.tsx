import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { SearchPage } from "@/features/search/SearchPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("SearchPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("busca y muestra resultados agrupados por tipo", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        results: [
          { type: "customer", id: "c1", label: "Rosa Salinas", detail: "0102030405" },
          { type: "legal_case", id: "lc1", label: "LEG-0001 · Civil", detail: "new" },
        ],
      },
    });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Texto a buscar"), { target: { value: "Rosa" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(screen.getByText("Rosa Salinas")).toBeInTheDocument());
    expect(screen.getByText("LEG-0001 · Civil")).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith("/search/", { params: { q: "Rosa" } });
  });

  it("muestra un mensaje cuando no hay resultados", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { results: [] } });

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Texto a buscar"), { target: { value: "nada" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(screen.getByText("No se encontraron resultados.")).toBeInTheDocument());
  });
});
