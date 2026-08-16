import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { DocumentsPanel } from "@/features/documents/DocumentsPanel";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("DocumentsPanel", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
  });

  it("muestra un mensaje cuando no hay documentos", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(<DocumentsPanel ownerType="customer" ownerId="cust-1" />);

    await waitFor(() => expect(screen.getByText("Sin documentos registrados todavía.")).toBeInTheDocument());
    expect(apiClient.get).toHaveBeenCalledWith("/documents/", {
      params: { owner_type: "customer", owner_id: "cust-1" },
    });
  });

  it("muestra los documentos devueltos por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "doc-1",
            owner_type: "customer",
            owner_id: "cust-1",
            name: "Contrato.pdf",
            file: "/media/documents/contrato.pdf",
            file_type: "application/pdf",
            size_bytes: 1024,
            version: 1,
            status: "active",
            uploaded_by_user: "user-1",
            created_at: "2026-01-01T10:00:00Z",
          },
        ],
      },
    });

    render(<DocumentsPanel ownerType="customer" ownerId="cust-1" />);

    await waitFor(() => expect(screen.getByText("Contrato.pdf")).toBeInTheDocument());
  });

  it("sube un documento con el nombre del archivo cuando no se especifica nombre", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { count: 0, next: null, previous: null, results: [] },
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: "doc-2",
        owner_type: "customer",
        owner_id: "cust-1",
        name: "prueba.pdf",
        file: "/media/documents/prueba.pdf",
        file_type: "application/pdf",
        size_bytes: 10,
        version: 1,
        status: "active",
        uploaded_by_user: "user-1",
        created_at: "2026-01-01T10:00:00Z",
      },
    });

    render(<DocumentsPanel ownerType="customer" ownerId="cust-1" />);
    await waitFor(() => expect(screen.getByText("Sin documentos registrados todavía.")).toBeInTheDocument());

    const file = new File(["contenido"], "prueba.pdf", { type: "application/pdf" });
    const fileInput = screen.getByLabelText("Archivo");
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Subir documento" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/documents/",
        expect.any(FormData),
        expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } })
      )
    );
  });
});
