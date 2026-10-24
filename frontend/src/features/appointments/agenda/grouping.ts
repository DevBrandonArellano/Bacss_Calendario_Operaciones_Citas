import { addDays, endOfMonth, startOfMonth, startOfWeek } from "@/lib/dates";

interface Dated {
  appointment_date: string;
  start_time: string;
}

/** Citas agrupadas por fecha «YYYY-MM-DD» (en orden cronológico) y ordenadas por hora dentro de cada día. */
export function groupByDate<T extends Dated>(appointments: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const appointment of appointments) {
    const day = groups.get(appointment.appointment_date) ?? [];
    day.push(appointment);
    groups.set(appointment.appointment_date, day);
  }
  for (const day of groups.values()) day.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** Semanas (lunes a domingo) que cubren el mes de `date`, incluyendo los días vecinos de relleno. */
export function monthMatrix(date: Date): Date[][] {
  const first = startOfWeek(startOfMonth(date));
  const last = endOfMonth(date);
  const weeks: Date[][] = [];
  for (let weekStart = first; weekStart <= last; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset)));
  }
  return weeks;
}
