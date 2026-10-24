import type { Schedule } from "@/types/schedule";

/** Escala vertical de la rejilla: 1 hora = 72 px, así 30 min = 36 px y 2 h = 144 px. */
export const PIXELS_PER_MINUTE = 1.2;
export const MIN_BLOCK_HEIGHT = 22;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const DEFAULT_WINDOW = { startMinute: 8 * MINUTES_PER_HOUR, endMinute: 19 * MINUTES_PER_HOUR };

export interface TimeWindow {
  startMinute: number;
  endMinute: number;
}

export interface TimedItem {
  id: string;
  start_time: string;
  end_time: string;
}

export interface PositionedBlock<T extends TimedItem> {
  appointment: T;
  /** Distancia desde el inicio de la ventana visible, en px. */
  top: number;
  height: number;
  /** Carril horizontal dentro de su grupo de solapes (0..lanes-1). */
  lane: number;
  lanes: number;
}

/** «HH:MM» o «HH:MM:SS» → minutos desde medianoche. */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Agrupa citas que se solapan (de forma transitiva) para repartirlas en carriles sin pisarse. */
function clusterByOverlap<T extends TimedItem>(items: T[]): T[][] {
  const sorted = [...items].sort(
    (a, b) => minutesOfDay(a.start_time) - minutesOfDay(b.start_time) || minutesOfDay(a.end_time) - minutesOfDay(b.end_time)
  );
  const clusters: T[][] = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (clusters.length === 0 || minutesOfDay(item.start_time) >= clusterEnd) {
      clusters.push([item]);
      clusterEnd = minutesOfDay(item.end_time);
    } else {
      clusters[clusters.length - 1].push(item);
      clusterEnd = Math.max(clusterEnd, minutesOfDay(item.end_time));
    }
  }
  return clusters;
}

/** Calcula posición y tamaño de los bloques de una columna (un día o un profesional). */
export function layoutColumn<T extends TimedItem>(items: T[], window: TimeWindow): PositionedBlock<T>[] {
  const blocks: PositionedBlock<T>[] = [];

  for (const cluster of clusterByOverlap(items)) {
    const laneEnds: number[] = [];
    const placed = cluster.map((item) => {
      const start = minutesOfDay(item.start_time);
      let lane = laneEnds.findIndex((end) => end <= start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = minutesOfDay(item.end_time);
      return { item, lane };
    });

    for (const { item, lane } of placed) {
      const visibleStart = Math.max(minutesOfDay(item.start_time), window.startMinute);
      const visibleEnd = Math.min(minutesOfDay(item.end_time), window.endMinute);
      blocks.push({
        appointment: item,
        top: (visibleStart - window.startMinute) * PIXELS_PER_MINUTE,
        height: Math.max((visibleEnd - visibleStart) * PIXELS_PER_MINUTE, MIN_BLOCK_HEIGHT),
        lane,
        lanes: laneEnds.length,
      });
    }
  }
  return blocks;
}

/**
 * Ventana horaria visible: se ajusta a los horarios laborales (sin descansos) y a las citas,
 * con una hora de margen y redondeada a horas completas.
 */
export function computeVisibleHours(schedules: Schedule[], appointments: TimedItem[]): TimeWindow {
  const starts: number[] = [];
  const ends: number[] = [];

  for (const schedule of schedules) {
    if (schedule.is_break) continue;
    starts.push(minutesOfDay(schedule.start_time));
    ends.push(minutesOfDay(schedule.end_time));
  }
  for (const appointment of appointments) {
    starts.push(minutesOfDay(appointment.start_time));
    ends.push(minutesOfDay(appointment.end_time));
  }

  if (starts.length === 0) return DEFAULT_WINDOW;

  const earliest = Math.min(...starts) - MINUTES_PER_HOUR;
  const latest = Math.max(...ends) + MINUTES_PER_HOUR;
  return {
    startMinute: Math.max(0, Math.floor(earliest / MINUTES_PER_HOUR) * MINUTES_PER_HOUR),
    endMinute: Math.min(MINUTES_PER_DAY, Math.ceil(latest / MINUTES_PER_HOUR) * MINUTES_PER_HOUR),
  };
}

export interface Segment {
  start: number;
  end: number;
}

/** Tramos trabajables de un día de la semana (0 = lunes) una vez restados los descansos. */
export function workingSegments(schedules: Schedule[], weekday: number): Segment[] {
  const ofDay = schedules.filter((s) => s.weekday === weekday);
  const breaks = ofDay
    .filter((s) => s.is_break)
    .map((s) => ({ start: minutesOfDay(s.start_time), end: minutesOfDay(s.end_time) }))
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  for (const work of ofDay.filter((s) => !s.is_break)) {
    let cursor = minutesOfDay(work.start_time);
    const end = minutesOfDay(work.end_time);
    for (const pause of breaks) {
      if (pause.end <= cursor || pause.start >= end) continue;
      if (pause.start > cursor) segments.push({ start: cursor, end: pause.start });
      cursor = Math.max(cursor, pause.end);
    }
    if (cursor < end) segments.push({ start: cursor, end });
  }
  return segments.sort((a, b) => a.start - b.start);
}

/** Franjas de la ventana visible que quedan fuera del horario laboral (complemento de `segments`). */
export function nonWorkingSegments(segments: Segment[], window: TimeWindow): Segment[] {
  const result: Segment[] = [];
  let cursor = window.startMinute;
  for (const segment of [...segments].sort((a, b) => a.start - b.start)) {
    if (segment.start > cursor) result.push({ start: cursor, end: Math.min(segment.start, window.endMinute) });
    cursor = Math.max(cursor, segment.end);
    if (cursor >= window.endMinute) break;
  }
  if (cursor < window.endMinute) result.push({ start: cursor, end: window.endMinute });
  return result.filter((segment) => segment.end > segment.start);
}

/** Minutos desde medianoche correspondientes a una posición vertical dentro de la columna, a múltiplos de `snap`. */
export function minutesAtOffset(offsetY: number, window: TimeWindow, snap = 30): number {
  const raw = window.startMinute + offsetY / PIXELS_PER_MINUTE;
  const snapped = Math.floor(raw / snap) * snap;
  return Math.min(Math.max(snapped, window.startMinute), window.endMinute - snap);
}
