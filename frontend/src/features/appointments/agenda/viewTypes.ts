import type { TimeWindow } from "@/features/appointments/agenda/timeGrid";
import type { BusinessNow } from "@/lib/businessTime";
import type { Appointment } from "@/types/appointment";
import type { Schedule } from "@/types/schedule";
import type { Employee } from "@/types/service";

/** Contrato común de las vistas de la Agenda: todas reciben los mismos datos y emiten los mismos eventos. */
export interface AgendaViewProps {
  /** Fecha de referencia del período visible. */
  date: Date;
  appointments: Appointment[];
  employees: Employee[];
  /** `null` = horarios no disponibles (sin permiso o error): no se sombrea la rejilla. */
  schedules: Schedule[] | null;
  window: TimeWindow;
  now: BusinessNow;
  selectedId: string;
  /** Profesional filtrado (vacío = todos). */
  employeeFilter: string;
  onSelect: (appointment: Appointment) => void;
  onSlotSelect?: (slot: { date: string; minutes: number; employeeId?: string }) => void;
  onOpenDay: (isoDate: string) => void;
}
