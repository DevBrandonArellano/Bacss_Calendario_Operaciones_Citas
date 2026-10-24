import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Brand } from "@/components/Brand";
import { SidebarNav } from "@/components/SidebarNav";
import { TopBar } from "@/components/TopBar";
import { CORE_SECTIONS, MODULE_SECTIONS, UTILITY_SECTION } from "@/components/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/useAuth";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { cn } from "@/lib/cn";

const SIDEBAR_ID = "app-sidebar";

/**
 * Estructura base (escritorio): barra lateral fija de 256 px (72 px colapsada) + columna con
 * barra superior de 64 px y contenido. Usa la escala de 4 px de Tailwind (p-4 = 16, gap-6 = 24,
 * py-8 = 32) en vez de valores arbitrarios.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const { logout, hasModule, modulesLoaded } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const activeModuleSections = modulesLoaded
    ? MODULE_SECTIONS.filter(({ code }) => hasModule(code)).map(({ section }) => section)
    : [];

  return (
    <div
      className={cn(
        "min-h-screen bg-page text-ink lg:grid",
        collapsed ? "lg:grid-cols-[4.5rem_minmax(0,1fr)]" : "lg:grid-cols-[16rem_minmax(0,1fr)]"
      )}
    >
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-(--color-overlay) lg:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        id={SIDEBAR_ID}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col gap-5 overflow-y-auto border-r border-line bg-chrome p-4 transition-transform duration-200",
          "lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:w-auto lg:translate-x-0",
          // Colapsada deja asomar los tooltips; expandida permite desplazar un menú largo.
          collapsed ? "lg:overflow-visible lg:px-3" : "lg:overflow-y-auto",
          menuOpen && "translate-x-0"
        )}
      >
        <div className={cn("flex h-8 items-center px-2", collapsed && "lg:justify-center lg:px-0")}>
          {collapsed ? (
            <span className="max-lg:hidden">
              <Brand compact />
            </span>
          ) : null}
          <span className={cn(collapsed && "lg:hidden")}>
            <Brand />
          </span>
        </div>

        <SidebarNav
          sections={[...CORE_SECTIONS, ...activeModuleSections, UTILITY_SECTION]}
          collapsed={collapsed}
          onNavigate={() => setMenuOpen(false)}
        />

        <div className="hidden border-t border-line pt-3 lg:block">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="size-4" aria-hidden="true" />
                Contraer
              </>
            )}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <TopBar
          menuOpen={menuOpen}
          menuControlsId={SIDEBAR_ID}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          onLogout={handleLogout}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
