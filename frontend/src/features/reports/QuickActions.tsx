import { CalendarDays, CalendarPlus, UserCog, UserPlus, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/Card";
import { useAuth } from "@/features/auth/useAuth";

interface QuickAction {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
  /** Permiso que habilita la acción; sin él no se muestra. */
  permission: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Crear cita", description: "Agenda un cliente", to: "/citas/nueva", icon: CalendarPlus, permission: "appointments:write" },
  { label: "Registrar cliente", description: "Alta de un cliente nuevo", to: "/clientes/nuevo", icon: UserPlus, permission: "customers:write" },
  { label: "Consultar agenda", description: "Ver citas y horarios", to: "/citas", icon: CalendarDays, permission: "appointments:read" },
  { label: "Gestionar profesionales", description: "Equipo y servicios", to: "/profesionales", icon: UserCog, permission: "employees:read" },
];

/** Accesos directos a lo más frecuente; solo los que el usuario puede ejecutar. */
export function QuickActions() {
  const { can } = useAuth();
  const actions = QUICK_ACTIONS.filter((action) => can(action.permission));
  if (actions.length === 0) return null;

  return (
    <section aria-labelledby="acciones-rapidas" className="mt-8">
      <h2 id="acciones-rapidas" className="m-0 mb-4 text-base font-semibold text-ink">
        Acciones rápidas
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map(({ label, description, to, icon: Icon }) => (
          <li key={to}>
            <Link to={to} className="block no-underline">
              <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-subtle">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-ink">{label}</span>
                  <span className="truncate text-xs text-muted">{description}</span>
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
