export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Lunes de la semana que contiene `date` (convención `date.weekday()` del backend: lunes=0). */
export function startOfWeek(date: Date): Date {
  const isoWeekday = (date.getDay() + 6) % 7; // 0=lunes ... 6=domingo
  return addDays(date, -isoWeekday);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function weekdayLabel(date: Date): string {
  return WEEKDAY_LABELS[(date.getDay() + 6) % 7];
}

export function formatDateEs(date: Date): string {
  return date.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}
