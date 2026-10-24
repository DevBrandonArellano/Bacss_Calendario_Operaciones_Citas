import { NavLink } from "react-router-dom";

import type { NavSection } from "@/components/navigation";
import { cn } from "@/lib/cn";

interface SidebarNavProps {
  sections: NavSection[];
  collapsed: boolean;
  onNavigate: () => void;
}

function linkClassName(collapsed: boolean) {
  return ({ isActive }: { isActive: boolean }): string =>
    cn(
      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink no-underline transition-colors hover:bg-subtle",
      collapsed && "lg:justify-center lg:px-0",
      // El estado activo no depende solo del color: fondo + negrita + barra lateral (WCAG 1.4.1).
      isActive && "bg-brand-soft font-bold shadow-[inset_3px_0_0_var(--color-primary)]"
    );
}

export function SidebarNav({ sections, collapsed, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Principal" className="flex flex-1 flex-col gap-5">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <p
            className={cn(
              "m-0 mb-1 px-3 text-[0.7rem] font-bold uppercase tracking-wider text-muted",
              collapsed && "lg:sr-only"
            )}
          >
            {section.title}
          </p>
          {section.items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClassName(collapsed)} onClick={onNavigate}>
              {({ isActive }) => (
                <>
                  <Icon className={cn("size-[1.15rem] shrink-0", isActive ? "text-brand" : "text-muted")} aria-hidden="true" />
                  {/* En modo colapsado el texto sigue disponible para lectores de pantalla. */}
                  <span className={cn(collapsed && "lg:sr-only")}>{label}</span>
                  {collapsed && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-page opacity-0 shadow-float transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
                    >
                      {label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
