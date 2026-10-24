import { Bell, LogOut, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { pageTitleFor } from "@/components/navigation";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/useAuth";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";

interface TopBarProps {
  menuOpen: boolean;
  menuControlsId: string;
  onToggleMenu: () => void;
  onLogout: () => void;
}

function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/** Barra superior de 64 px: título contextual, tema, notificaciones, perfil y cierre de sesión. */
export function TopBar({ menuOpen, menuControlsId, onToggleMenu, onLogout }: TopBarProps) {
  const { pathname } = useLocation();
  const { profile, organization } = useAuth();
  const unread = useUnreadNotifications();

  const displayName = profile?.full_name ?? "";
  const role = profile?.roles[0]?.name;
  const notificationsLabel = unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-chrome px-4 lg:px-8">
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden"
        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuOpen}
        aria-controls={menuControlsId}
        onClick={onToggleMenu}
      >
        {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </Button>

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-base font-semibold text-ink">{pageTitleFor(pathname)}</p>
        {organization && <p className="m-0 hidden truncate text-xs text-muted sm:block">{organization.name}</p>}
      </div>

      <div className="w-28 shrink-0 max-sm:hidden">
        <ThemeToggle />
      </div>

      <Link
        to="/notificaciones"
        aria-label={notificationsLabel}
        className="relative grid size-10 place-items-center rounded-xl text-ink hover:bg-subtle"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 grid min-w-4.5 place-items-center rounded-full bg-brand px-1 text-[0.65rem] font-bold leading-4.5 text-on-brand"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>

      <div className="flex items-center gap-2.5" title={profile ? `${displayName} · ${profile.email}` : undefined}>
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand"
        >
          {initialsOf(displayName)}
        </span>
        {profile && (
          <span className="hidden min-w-0 flex-col leading-tight xl:flex">
            <span className="max-w-40 truncate text-sm font-semibold text-ink">{displayName}</span>
            {role && <span className="text-xs text-muted">{role}</span>}
          </span>
        )}
      </div>

      <Button variant="secondary" size="sm" onClick={onLogout}>
        <LogOut className="size-4" aria-hidden="true" />
        <span className="max-sm:sr-only">Cerrar sesión</span>
      </Button>
    </header>
  );
}
