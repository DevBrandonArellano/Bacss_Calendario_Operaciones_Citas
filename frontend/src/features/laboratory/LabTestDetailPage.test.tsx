import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { LabTestDetailPage } from "@/features/laboratory/LabTestDetailPage";

const { MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return { MockApiError };
});

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: MockApiError,
}));

const BASE_LAB_TEST = {
  id: "test-1",
  lab_order: "order-1",
  test_code: "HEM001",
  test_name: "Hemograma completo",
  sample: null,
  result: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/laboratorio/pruebas/test-1"]}>
      <Routes>
        <Route path="/laboratorio/pruebas/:id" element={<LabTestDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LabTestDetailPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("muestra el botón para avanzar desde 'ordered'", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { ...BASE_LAB_TEST, status: "ordered" } });

    renderPage();

    await waitFor(() => expect(screen.getByText("Solicitada")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Marcar esperando toma de muestra" })).toBeInTheDocument();
  });

  it("carga y muestra el resultado clínico cuando el usuario tiene permiso", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: { ...BASE_LAB_TEST, status: "result_available", result: { id: "result-1" } },
      })
      .mockResolvedValueOnce({
        data: {
          id: "result-1",
          lab_test: "test-1",
          result_value: "12.5",
          unit: "g/dL",
          reference_range: "12-16",
          observations: "",
          validated_by_employee: null,
          validated_at: null,
        },
      });

    renderPage();

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith("/modules/laboratory/lab-results/result-1/"));
    await waitFor(() => expect(screen.getByText("Valor: 12.5 g/dL")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Validar resultado" })).toBeInTheDocument();
  });

  it("muestra un mensaje cuando el usuario no tiene permiso para ver el resultado", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: { ...BASE_LAB_TEST, status: "result_available", result: { id: "result-1" } },
      })
      .mockRejectedValueOnce(new MockApiError("No tiene permiso.", 403));

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText("No tienes permiso para ver el valor clínico de este resultado.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText(/^Valor:/)).not.toBeInTheDocument();
  });
});
