import {
  Bell,
  CalendarCheck,
  CreditCard,
  LayoutDashboard,
  type LucideIcon,
  ShieldCheck,
  Users,
} from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Detalle verificable de lo que el producto hace hoy (página de funcionalidades). */
  points: string[];
}

export interface Vertical {
  name: string;
  description: string;
  points: string[];
}

export interface Step {
  title: string;
  description: string;
}

export const FEATURES: Feature[] = [
  {
    icon: CalendarCheck,
    title: "Agenda sin choques de horario",
    description:
      "Calendario por día, semana y mes. El sistema bloquea reservas simultáneas, respeta descansos, feriados y ausencias.",
    points: [
      "Vistas de día, semana, mes y agenda por profesional",
      "Horarios del negocio y de cada profesional, con descansos y bloqueos manuales",
      "Confirmación, cancelación y reprogramación de citas",
    ],
  },
  {
    icon: Bell,
    title: "Recordatorios automáticos",
    description: "Avisos por correo antes de cada cita para reducir las ausencias sin que tengas que escribir a nadie.",
    points: [
      "Recordatorios por correo electrónico programados",
      "Centro de notificaciones dentro de la aplicación",
      "WhatsApp y SMS aún no están disponibles",
    ],
  },
  {
    icon: Users,
    title: "Clientes e historial",
    description: "Ficha de cada cliente con su historial de citas, pagos y documentos en un solo lugar.",
    points: [
      "Búsqueda por nombre, documento, teléfono o correo",
      "Historial de citas y pagos por cliente",
      "Documentos y tareas asociados a cada ficha",
    ],
  },
  {
    icon: CreditCard,
    title: "Pagos y reembolsos",
    description: "Registra pagos completos o parciales, vincúlalos a la cita y consulta el estado de cuenta al instante.",
    points: [
      "Pagos en efectivo, transferencia, tarjeta u otros, registrados manualmente",
      "Pagos parciales con estado de cobro por cita",
      "Reembolsos con registro de auditoría",
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Reportes y dashboard",
    description: "Citas del día, ingresos del mes, servicios más pedidos y productividad de tu equipo, de un vistazo.",
    points: [
      "Indicadores del día y de los próximos 7 días",
      "Gráficos de citas, ingresos y servicios más solicitados",
      "Cifras financieras visibles solo para quien tiene permiso",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Seguro y por empresa",
    description:
      "Cada empresa trabaja en un espacio aislado, con roles y permisos por usuario y registro de auditoría de acciones sensibles.",
    points: [
      "Datos separados por empresa",
      "Roles y permisos por usuario con mínimo privilegio",
      "Registro de auditoría que no se puede borrar desde la aplicación",
    ],
  },
];

export const VERTICALS: Vertical[] = [
  {
    name: "Talleres de motos",
    description: "Motos, historial vehicular y órdenes de trabajo con repuestos y mano de obra.",
    points: ["Ficha de cada moto con su historial", "Órdenes de trabajo con estados y total calculado"],
  },
  {
    name: "Laboratorios clínicos",
    description: "Pacientes, pedidos y seguimiento de muestras con permisos estrictos sobre resultados.",
    points: ["Seguimiento del proceso de cada prueba", "Resultados con permiso aparte y acceso auditado"],
  },
  {
    name: "Tiendas y lanzamientos",
    description: "Catálogo, variantes, inventario, preventas y pedidos con control de stock.",
    points: ["Productos con variantes e inventario", "Pedidos que descuentan y restituyen stock"],
  },
  {
    name: "Despachos de abogados",
    description: "Casos, audiencias, tareas y cronología con acceso solo a los casos propios.",
    points: ["Cronología de cada caso", "Cada profesional ve únicamente sus casos asignados"],
  },
];

export const STEPS: Step[] = [
  { title: "Configura tu negocio", description: "Crea tu empresa, sucursales, servicios y el horario de tu equipo." },
  { title: "Agenda y atiende", description: "Reserva citas, confirma y da seguimiento desde una agenda clara." },
  { title: "Mide y mejora", description: "Revisa ingresos, cancelaciones y productividad para decidir con datos." },
];
