import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { CaseDetailPage } from "@/features/legal/CaseDetailPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const CASE = {
  id: "case-1",
  case_number: "LEG-0001",
  customer: "cust-1",
  case_type: "Civil",
  responsible_lawyer: "emp-1",
  status: "new",
  opened_at: "2026-01-01",
  closed_at: null,
  priority: "high",
  description: "",
};

const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] };

function mockGetByUrl(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === "/modules/legal/cases/case-1/") {
      return Promise.resolve({ data: overrides.legalCase ?? CASE });
    }
    return Promise.resolve({ data: EMPTY_PAGE });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/legal/casos/case-1"]}>
      <Routes>
        <Route path="/legal/casos/:id" element={<CaseDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CaseDetailPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("muestra el caso y los botones de transición válidos desde 'new'", async () => {
    mockGetByUrl();

    renderPage();

    await waitFor(() => expect(screen.getByText("Caso LEG-0001")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Pasar a: En revisión" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pasar a: Cerrado" })).toBeInTheDocument();
  });

  it("cambia de estado al hacer clic en una transición", async () => {
    mockGetByUrl();
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { ...CASE, status: "in_review" } });

    renderPage();

    const button = await screen.findByRole("button", { name: "Pasar a: En revisión" });

    mockGetByUrl({ legalCase: { ...CASE, status: "in_review" } });
    fireEvent.click(button);

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith("/modules/legal/cases/case-1/transition/", {
        status: "in_review",
      })
    );
  });

  it("no muestra transiciones cuando el caso está archivado", async () => {
    mockGetByUrl({ legalCase: { ...CASE, status: "archived" } });

    renderPage();

    await waitFor(() => expect(screen.getByText("Este caso llegó a su estado final.")).toBeInTheDocument());
  });
});
