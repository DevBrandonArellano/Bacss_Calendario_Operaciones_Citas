import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { PatientListPage } from "@/features/laboratory/PatientListPage";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("PatientListPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra los pacientes devueltos por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "1",
            customer: null,
            first_name: "Elena",
            last_name: "Ramírez",
            document_number: "0102030405",
            birth_date: "1990-01-01",
            sex: "female",
            medical_notes: "",
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <PatientListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Elena Ramírez")).toBeInTheDocument());
    expect(screen.getByText("0102030405")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay pacientes", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(
      <MemoryRouter>
        <PatientListPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText("No hay pacientes registrados todavía.")).toBeInTheDocument()
    );
  });
});
