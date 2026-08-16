import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/features/auth/AuthContext";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

// El entorno de test (Node 22+, `localStorage` global) choca con el
// localStorage de jsdom que usa `tokenStorage`; se mockea el módulo en vez
// de depender de storage real, que no hace falta para estos tests.
vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    getAccess: () => "fake-access-token",
    getRefresh: () => "fake-refresh-token",
    set: vi.fn(),
    setAccess: vi.fn(),
    clear: vi.fn(),
  },
}));

function renderLayout(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <AppLayout>
          <p>Contenido</p>
        </AppLayout>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AppLayout — navegación dinámica por módulo activo", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra los enlaces del módulo Taller cuando 'moto' está activo", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: "org-1",
        name: "Motors Ecuador",
        modules: [{ id: "m1", module_code: "moto", is_active: true, config: {}, activated_at: "", deactivated_at: null }],
      },
    });

    renderLayout();

    await waitFor(() => expect(screen.getByText("Motos")).toBeInTheDocument());
    expect(screen.getByText("Órdenes de trabajo")).toBeInTheDocument();
  });

  it("no muestra los enlaces del módulo Taller cuando 'moto' está inactivo", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: "org-2", name: "Laboratorio ABC", modules: [] },
    });

    renderLayout();

    await waitFor(() => expect(screen.getByText("Pagos")).toBeInTheDocument());
    expect(screen.queryByText("Motos")).not.toBeInTheDocument();
    expect(screen.queryByText("Órdenes de trabajo")).not.toBeInTheDocument();
  });

  it("marca la página actual en la navegación con aria-current", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: "org-1", name: "Motors Ecuador", modules: [] },
    });

    renderLayout("/clientes");

    const clientesLink = await screen.findByRole("link", { name: "Clientes" });
    expect(clientesLink).toHaveAttribute("aria-current", "page");

    const agendaLink = screen.getByRole("link", { name: "Agenda" });
    expect(agendaLink).not.toHaveAttribute("aria-current");
  });
});
