import {
  Bell,
  Bike,
  Briefcase,
  CalendarDays,
  CreditCard,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Scale,
  Search,
  ShoppingBag,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const CORE_SECTIONS: NavSection[] = [
  {
    title: "Operación",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/citas", label: "Agenda", icon: CalendarDays },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/pagos", label: "Pagos", icon: CreditCard },
    ],
  },
  {
    title: "Configuración",
    items: [
      { to: "/servicios", label: "Servicios", icon: Briefcase },
      { to: "/profesionales", label: "Profesionales", icon: UserCog },
    ],
  },
];

/** Secciones que solo aparecen si la organización tiene el módulo activo. */
export const MODULE_SECTIONS: { code: string; section: NavSection }[] = [
  {
    code: "moto",
    section: {
      title: "Taller",
      items: [
        { to: "/motos", label: "Motos", icon: Bike },
        { to: "/ordenes-trabajo", label: "Órdenes de trabajo", icon: Wrench },
      ],
    },
  },
  {
    code: "laboratory",
    section: {
      title: "Laboratorio",
      items: [
        { to: "/laboratorio/pacientes", label: "Pacientes", icon: HeartPulse },
        { to: "/laboratorio/pedidos", label: "Pedidos de laboratorio", icon: FlaskConical },
      ],
    },
  },
  {
    code: "store",
    section: {
      title: "Tienda",
      items: [
        { to: "/tienda/productos", label: "Productos", icon: Package },
        { to: "/tienda/pedidos", label: "Pedidos de tienda", icon: ShoppingBag },
      ],
    },
  },
  {
    code: "legal",
    section: { title: "Legal", items: [{ to: "/legal/casos", label: "Casos", icon: Scale }] },
  },
];

export const UTILITY_SECTION: NavSection = {
  title: "General",
  items: [
    { to: "/notificaciones", label: "Notificaciones", icon: Bell },
    { to: "/buscar", label: "Buscar", icon: Search },
  ],
};

/** Títulos de pantallas que no están en el menú (formularios, detalles). */
const EXTRA_PAGE_TITLES: Record<string, string> = {
  "/citas/nueva": "Nueva cita",
  "/clientes/nuevo": "Nuevo cliente",
  "/reportes": "Reportes",
};

const ALL_MENU_ITEMS: NavItem[] = [
  ...CORE_SECTIONS,
  ...MODULE_SECTIONS.map(({ section }) => section),
  UTILITY_SECTION,
].flatMap((section) => section.items);

/** Título contextual para la barra superior y el título del documento. */
export function pageTitleFor(pathname: string): string {
  const exact = EXTRA_PAGE_TITLES[pathname] ?? ALL_MENU_ITEMS.find((item) => item.to === pathname)?.label;
  if (exact) return exact;
  // Subrutas (p. ej. /clientes/123/editar) heredan el título de su sección.
  const parent = [...ALL_MENU_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname.startsWith(`${item.to}/`));
  return parent?.label ?? "Bacss Citas";
}
