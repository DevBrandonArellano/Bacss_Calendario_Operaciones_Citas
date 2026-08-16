import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ModuleRoute } from "@/routes/ModuleRoute";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

// Ver nota en AppLayout.test.tsx: se mockea tokenStorage para evitar el
// choque entre el localStorage global de Node y el de jsdom.
vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    getAccess: () => "fake-access-token",
    getRefresh: () => "fake-refresh-token",
    set: vi.fn(),
    setAccess: vi.fn(),
    clear: vi.fn(),
  },
}));

function renderGuardedRoute() {
  return render(
    <MemoryRouter initialEntries={["/motos"]}>
      <AuthProvider>
        <Routes>
          <Route path="/citas" element={<p>Agenda</p>} />
          <Route
            path="/motos"
            element={
              <ModuleRoute moduleCode="moto">
                <p>Pantalla de motos</p>
              </ModuleRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("ModuleRoute", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra la pantalla cuando el módulo está activo", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        id: "org-1",
        modules: [{ id: "m1", module_code: "moto", is_active: true, config: {}, activated_at: "", deactivated_at: null }],
      },
    });

    renderGuardedRoute();

    await waitFor(() => expect(screen.getByText("Pantalla de motos")).toBeInTheDocument());
  });

  it("redirige cuando el módulo no está activo", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { id: "org-2", modules: [] } });

    renderGuardedRoute();

    await waitFor(() => expect(screen.getByText("Agenda")).toBeInTheDocument());
    expect(screen.queryByText("Pantalla de motos")).not.toBeInTheDocument();
  });
});
