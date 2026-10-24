import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? "nav-link-active" : "";
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { logout, hasModule, modulesLoaded } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <nav>
          <NavLink to="/dashboard" className={navLinkClassName}>
            Dashboard
          </NavLink>
          <NavLink to="/citas" className={navLinkClassName}>
            Agenda
          </NavLink>
          <NavLink to="/clientes" className={navLinkClassName}>
            Clientes
          </NavLink>
          <NavLink to="/servicios" className={navLinkClassName}>
            Servicios
          </NavLink>
          <NavLink to="/profesionales" className={navLinkClassName}>
            Profesionales
          </NavLink>
          <NavLink to="/pagos" className={navLinkClassName}>
            Pagos
          </NavLink>
          {modulesLoaded && hasModule("moto") && (
            <>
              <NavLink to="/motos" className={navLinkClassName}>
                Motos
              </NavLink>
              <NavLink to="/ordenes-trabajo" className={navLinkClassName}>
                Órdenes de trabajo
              </NavLink>
            </>
          )}
          {modulesLoaded && hasModule("laboratory") && (
            <>
              <NavLink to="/laboratorio/pacientes" className={navLinkClassName}>
                Pacientes
              </NavLink>
              <NavLink to="/laboratorio/pedidos" className={navLinkClassName}>
                Pedidos de laboratorio
              </NavLink>
            </>
          )}
          {modulesLoaded && hasModule("store") && (
            <>
              <NavLink to="/tienda/productos" className={navLinkClassName}>
                Productos
              </NavLink>
              <NavLink to="/tienda/pedidos" className={navLinkClassName}>
                Pedidos de tienda
              </NavLink>
            </>
          )}
          {modulesLoaded && hasModule("legal") && (
            <NavLink to="/legal/casos" className={navLinkClassName}>
              Casos
            </NavLink>
          )}
          <NavLink to="/notificaciones" className={navLinkClassName}>
            Notificaciones
          </NavLink>
          <NavLink to="/buscar" className={navLinkClassName}>
            Buscar
          </NavLink>
        </nav>
        <div className="app-header-actions">
          <ThemeToggle />
          <button type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
