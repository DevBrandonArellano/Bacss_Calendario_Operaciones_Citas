import {
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  Clock,
  Hourglass,
  type LucideIcon,
  PlayCircle,
  UserX,
  XCircle,
} from "lucide-react";

import { STATUS_LABELS, type AppointmentStatus } from "@/types/appointment";

/** Clases completas (Tailwind no detecta nombres construidos dinámicamente). */
export interface StatusStyle {
  label: string;
  icon: LucideIcon;
  /** Insignia: fondo tenue + texto con contraste AA. */
  chip: string;
  /** Bloque de calendario: fondo tenue + barra lateral del color de acento. */
  block: string;
  /** Punto/indicador de acento. */
  dot: string;
}

/**
 * Significado visual único de cada estado en toda la app. El color nunca es la única señal:
 * cada estado también lleva icono y texto. Un estado nuevo del dominio solo agrega una entrada aquí.
 */
export const APPOINTMENT_STATUS_STYLE: Record<AppointmentStatus, StatusStyle> = {
  pending: {
    label: STATUS_LABELS.pending,
    icon: Clock,
    chip: "bg-status-pending-soft text-status-pending-fg",
    block: "bg-status-pending-soft text-status-pending-fg border-status-pending",
    dot: "bg-status-pending",
  },
  confirmed: {
    label: STATUS_LABELS.confirmed,
    icon: CheckCircle2,
    chip: "bg-status-confirmed-soft text-status-confirmed-fg",
    block: "bg-status-confirmed-soft text-status-confirmed-fg border-status-confirmed",
    dot: "bg-status-confirmed",
  },
  waiting: {
    label: STATUS_LABELS.waiting,
    icon: Hourglass,
    chip: "bg-status-pending-soft text-status-pending-fg",
    block: "bg-status-pending-soft text-status-pending-fg border-status-pending",
    dot: "bg-status-pending",
  },
  in_progress: {
    label: STATUS_LABELS.in_progress,
    icon: PlayCircle,
    chip: "bg-status-progress-soft text-status-progress-fg",
    block: "bg-status-progress-soft text-status-progress-fg border-status-progress",
    dot: "bg-status-progress",
  },
  completed: {
    label: STATUS_LABELS.completed,
    icon: CheckCheck,
    chip: "bg-status-completed-soft text-status-completed-fg",
    block: "bg-status-completed-soft text-status-completed-fg border-status-completed",
    dot: "bg-status-completed",
  },
  cancelled: {
    label: STATUS_LABELS.cancelled,
    icon: XCircle,
    chip: "bg-status-cancelled-soft text-status-cancelled-fg",
    block: "bg-status-cancelled-soft text-status-cancelled-fg border-status-cancelled",
    dot: "bg-status-cancelled",
  },
  no_show: {
    label: STATUS_LABELS.no_show,
    icon: UserX,
    chip: "bg-status-noshow-soft text-status-noshow-fg",
    block: "bg-status-noshow-soft text-status-noshow-fg border-status-noshow",
    dot: "bg-status-noshow",
  },
  rescheduled: {
    label: STATUS_LABELS.rescheduled,
    icon: CalendarClock,
    chip: "bg-status-rescheduled-soft text-status-rescheduled-fg",
    block: "bg-status-rescheduled-soft text-status-rescheduled-fg border-status-rescheduled",
    dot: "bg-status-rescheduled",
  },
};

/** Estados que ocupan la agenda del profesional (espejo de `ACTIVE_APPOINTMENT_STATUSES` del backend). */
export const ACTIVE_STATUSES: readonly AppointmentStatus[] = ["pending", "confirmed", "waiting", "in_progress"];

export const ALL_STATUSES = Object.keys(APPOINTMENT_STATUS_STYLE) as AppointmentStatus[];
