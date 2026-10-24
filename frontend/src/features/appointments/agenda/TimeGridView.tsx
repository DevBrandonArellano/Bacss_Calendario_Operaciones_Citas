import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

import { AppointmentBlock } from "@/features/appointments/agenda/AppointmentBlock";
import {
  PIXELS_PER_MINUTE,
  formatMinutes,
  layoutColumn,
  minutesAtOffset,
  minutesOfDay,
  nonWorkingSegments,
  type Segment,
  type TimeWindow,
} from "@/features/appointments/agenda/timeGrid";
import { cn } from "@/lib/cn";
import type { BusinessNow } from "@/lib/businessTime";
import type { Appointment } from "@/types/appointment";

export interface GridColumn {
  key: string;
  /** Fecha «YYYY-MM-DD» de la columna (para el indicador de hora actual y para crear citas). */
  date: string;
  header: ReactNode;
  appointments: Appointment[];
  /** Tramos laborales del día; `null` = horario desconocido (no se sombrea nada). */
  workingSegments: Segment[] | null;
  /** Profesional de la columna, para preseleccionarlo al crear una cita en un hueco. */
  employeeId?: string;
}

interface TimeGridProps {
  columns: GridColumn[];
  window: TimeWindow;
  now: BusinessNow;
  /** Cambia cuando cambia el período visible: reposiciona el desplazamiento vertical. */
  scrollKey: string;
  showEmployee: boolean;
  selectedId: string;
  minColumnWidthRem: number;
  onSelect: (appointment: Appointment) => void;
  onSlotSelect?: (slot: { date: string; minutes: number; employeeId?: string }) => void;
}

const HOUR_LABEL_WIDTH_REM = 3.5;
const SCROLL_MARGIN_PX = 72;

/**
 * Rejilla horaria compartida por las vistas Día, Semana y Profesional. Las columnas pueden ser
 * días o profesionales; las citas se dibujan con alto proporcional a su duración. Hacer clic en
 * un hueco libre abre «Nueva cita» con fecha y hora preseleccionadas (alternativa con teclado:
 * el botón «Nueva cita» del encabezado).
 */
export function TimeGridView({
  columns,
  window: timeWindow,
  now,
  scrollKey,
  showEmployee,
  selectedId,
  minColumnWidthRem,
  onSelect,
  onSlotSelect,
}: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalHeight = (timeWindow.endMinute - timeWindow.startMinute) * PIXELS_PER_MINUTE;
  const firstHour = Math.ceil(timeWindow.startMinute / 60);
  const lastHour = Math.floor(timeWindow.endMinute / 60);
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);

  // Al cambiar de período: ir a la hora actual si está dentro del horario laboral de hoy; si no, a la
  // primera cita; y si tampoco hay, al inicio del horario. Así no se aterriza en una zona vacía.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const starts = columns.flatMap((column) => column.appointments.map((a) => minutesOfDay(a.start_time)));
    const todayColumn = columns.find((column) => column.date === now.date);
    const nowIsWorking =
      todayColumn !== undefined &&
      (todayColumn.workingSegments === null ||
        todayColumn.workingSegments.some((segment) => segment.start <= now.minutes && now.minutes <= segment.end));
    const target = nowIsWorking ? now.minutes : starts.length > 0 ? Math.min(...starts) : timeWindow.startMinute;
    const clamped = Math.min(Math.max(target, timeWindow.startMinute), timeWindow.endMinute);
    container.scrollTop = Math.max(0, (clamped - timeWindow.startMinute) * PIXELS_PER_MINUTE - SCROLL_MARGIN_PX);
    // Solo al cambiar de período, no en cada actualización de datos (evita saltos al editar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  function handleColumnClick(event: MouseEvent<HTMLDivElement>, column: GridColumn) {
    if (!onSlotSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSlotSelect({
      date: column.date,
      minutes: minutesAtOffset(event.clientY - rect.top, timeWindow),
      employeeId: column.employeeId,
    });
  }

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="Calendario de citas"
      tabIndex={0} // una región con scroll debe poder enfocarse para desplazarla con el teclado (WCAG 2.1.1)
      className="max-h-[calc(100vh-17rem)] min-h-[26rem] overflow-auto rounded-card border border-line bg-surface shadow-card">
      <div style={{ minWidth: `${HOUR_LABEL_WIDTH_REM + columns.length * minColumnWidthRem}rem` }}>
        <div className="sticky top-0 z-20 flex border-b border-line bg-surface">
          <div className="shrink-0" style={{ width: `${HOUR_LABEL_WIDTH_REM}rem` }} />
          {columns.map((column) => (
            <div key={column.key} className="min-w-0 flex-1 border-l border-line">
              {column.header}
            </div>
          ))}
        </div>

        <div className="flex">
          <div className="relative shrink-0" style={{ width: `${HOUR_LABEL_WIDTH_REM}rem`, height: totalHeight }} aria-hidden="true">
            {hours.map((hour) => (
              <span
                key={hour}
                className="absolute right-2 text-xs tabular-nums text-muted"
                style={{ top: (hour * 60 - timeWindow.startMinute) * PIXELS_PER_MINUTE + 3 }}
              >
                {formatMinutes(hour * 60)}
              </span>
            ))}
          </div>

          {columns.map((column) => {
            const blocks = layoutColumn(column.appointments, timeWindow);
            const shaded = column.workingSegments ? nonWorkingSegments(column.workingSegments, timeWindow) : [];
            const noSchedule = column.workingSegments !== null && column.workingSegments.length === 0;
            const showNow = column.date === now.date && now.minutes >= timeWindow.startMinute && now.minutes <= timeWindow.endMinute;

            return (
              <div
                key={column.key}
                role="presentation"
                className={cn("relative min-w-0 flex-1 border-l border-line", onSlotSelect && "cursor-cell")}
                style={{ height: totalHeight }}
                onClick={(event) => handleColumnClick(event, column)}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 border-t border-line/70"
                    style={{ top: (hour * 60 - timeWindow.startMinute) * PIXELS_PER_MINUTE }}
                  />
                ))}

                {shaded.map((segment) => (
                  <div
                    key={segment.start}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bg-subtle/70"
                    style={{
                      top: (segment.start - timeWindow.startMinute) * PIXELS_PER_MINUTE,
                      height: (segment.end - segment.start) * PIXELS_PER_MINUTE,
                    }}
                  />
                ))}
                {noSchedule && (
                  <span className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-medium text-muted">
                    Sin horario laboral
                  </span>
                )}

                {blocks.map((block) => (
                  <AppointmentBlock
                    key={block.appointment.id}
                    block={block}
                    selected={block.appointment.id === selectedId}
                    showEmployee={showEmployee}
                    onSelect={onSelect}
                  />
                ))}

                {showNow && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: (now.minutes - timeWindow.startMinute) * PIXELS_PER_MINUTE }}
                  >
                    <span className="-ml-1 size-2.5 rounded-full bg-status-cancelled" />
                    <span className="h-0.5 flex-1 bg-status-cancelled" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
