import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

interface ApiFixture {
  modules?: string[];
  unread?: number;
  permissions?: string[];
  notificationsFail?: boolean;
}

/** Responde por URL (el orden de las peticiones del layout no es parte del contrato). */
function mockApi({ modules = [], unread = 0, permissions = [], notificationsFail = false }: ApiFixture = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url === "/organizations/me/") {
      return Promise.resolve({
        data: {
          id: "org-1",
          name: "Motors Ecuador",
          timezone: "America/Guayaquil",
          default_currency: "USD",
          modules: modules.map((code) => ({
            id: code,
            module_code: code,
            is_active: true,
            config: {},
            activated_at: "",
            deactivated_at: null,
          })),
        },
      });
    }
    if (url === "/users/me/") {
      return Promise.resolve({
        data: {
          id: "u1",
          email: "admin@motors.test",
          first_name: "Ana",
          last_name: "Admin",
          full_name: "Ana Admin",
          roles: [{ id: "r1", code: "org_admin", name: "Administrador" }],
          permissions,
        },
      });
    }
    if (url === "/notifications/") {
      if (notificationsFail) return Promise.reject(new Error("403"));
      return Promise.resolve({ data: { count: unread, next: null, previous: null, results: [] } });
    }
    return Promise.resolve({ data: {} });
  });
}

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
    mockApi({ modules: ["moto"] });

    renderLayout();

    await waitFor(() => expect(screen.getByText("Motos")).toBeInTheDocument());
    expect(screen.getByText("Órdenes de trabajo")).toBeInTheDocument();
  });

  it("no muestra los enlaces del módulo Taller cuando 'moto' está inactivo", async () => {
    mockApi();

    renderLayout();

    await waitFor(() => expect(screen.getByText("Pagos")).toBeInTheDocument());
    expect(screen.queryByText("Motos")).not.toBeInTheDocument();
    expect(screen.queryByText("Órdenes de trabajo")).not.toBeInTheDocument();
  });

  it("marca la página actual en la navegación con aria-current", async () => {
    mockApi();

    renderLayout("/clientes");

    const clientesLink = await screen.findByRole("link", { name: "Clientes" });
    expect(clientesLink).toHaveAttribute("aria-current", "page");

    const agendaLink = screen.getByRole("link", { name: "Agenda" });
    expect(agendaLink).not.toHaveAttribute("aria-current");
  });
});

describe("AppLayout — barra superior y barra lateral", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it("muestra el título contextual de la pantalla actual", async () => {
    mockApi();

    renderLayout("/clientes/abc/editar");

    // El título de la sección se hereda en subrutas.
    await waitFor(() => expect(screen.getAllByText("Clientes").length).toBeGreaterThan(1));
  });

  it("muestra el nombre del usuario y la empresa cuando el perfil carga", async () => {
    mockApi();

    renderLayout();

    expect(await screen.findByText("Ana Admin")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByText("Motors Ecuador")).toBeInTheDocument();
  });

  it("indica las notificaciones sin leer en el enlace accesible", async () => {
    mockApi({ unread: 3 });

    renderLayout();

    expect(await screen.findByRole("link", { name: "Notificaciones, 3 sin leer" })).toBeInTheDocument();
  });

  it("si las notificaciones fallan no rompe el layout", async () => {
    mockApi({ notificationsFail: true });

    renderLayout();

    // Menú lateral + campana de la barra superior: ambos siguen disponibles sin contador.
    expect(await screen.findAllByRole("link", { name: "Notificaciones" })).toHaveLength(2);
  });

  it("la barra lateral se puede contraer y recuerda el estado accesiblemente", async () => {
    mockApi();
    renderLayout();

    const toggle = await screen.findByRole("button", { name: "Contraer barra lateral" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    const expand = await screen.findByRole("button", { name: "Expandir barra lateral" });
    expect(expand).toHaveAttribute("aria-pressed", "true");
    // Colapsada, los enlaces conservan su nombre accesible.
    expect(screen.getByRole("link", { name: "Clientes" })).toBeInTheDocument();
  });

  it("el menú móvil informa su estado con aria-expanded", async () => {
    mockApi();
    renderLayout();

    const button = await screen.findByRole("button", { name: "Abrir menú" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
  });
});
