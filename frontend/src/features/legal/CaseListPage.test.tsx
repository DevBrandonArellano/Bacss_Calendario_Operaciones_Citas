import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { CaseListPage } from "@/features/legal/CaseListPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("CaseListPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra los casos devueltos por la API", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === "/customers/") return Promise.resolve({ data: { count: 0, next: null, previous: null, results: [] } });
      if (url === "/employees/") return Promise.resolve({ data: { count: 0, next: null, previous: null, results: [] } });
      return Promise.resolve({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: "1",
              case_number: "LEG-0001",
              customer: "cust-1",
              case_type: "Civil",
              responsible_lawyer: "emp-1",
              status: "new",
              opened_at: "2026-01-01",
              closed_at: null,
              priority: "high",
              description: "",
            },
          ],
        },
      });
    });

    render(
      <MemoryRouter>
        <CaseListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("LEG-0001")).toBeInTheDocument());
    expect(screen.getByText("Civil")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay casos", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(
      <MemoryRouter>
        <CaseListPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText("No hay casos registrados todavía.")).toBeInTheDocument()
    );
  });
});
