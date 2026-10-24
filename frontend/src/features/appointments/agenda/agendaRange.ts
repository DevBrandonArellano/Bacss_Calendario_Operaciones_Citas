import { addDays, endOfMonth, startOfMonth, startOfWeek } from "@/lib/dates";

export type AgendaView = "day" | "week" | "month" | "professional" | "list";

export const AGENDA_VIEWS: AgendaView[] = ["day", "week", "month", "professional", "list"];

export const AGENDA_VIEW_LABELS: Record<AgendaView, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  professional: "Por profesional",
  list: "Lista",
};

const LIST_RANGE_DAYS = 30;

export interface DateRange {
  from: Date;
  to: Date;
}

/** Rango de fechas (inclusivo) que cubre cada vista. Lógica pura, sin UI. */
export function computeRange(view: AgendaView, current: Date): DateRange {
  switch (view) {
    case "day":
      return { from: current, to: current };
    case "week":
    case "professional": {
      const from = startOfWeek(current);
      return { from, to: addDays(from, 6) };
    }
    case "month":
      return { from: startOfMonth(current), to: endOfMonth(current) };
    case "list":
      return { from: current, to: addDays(current, LIST_RANGE_DAYS) };
  }
}

/** Avanza o retrocede un período de la vista (`direction` = 1 siguiente, -1 anterior). */
export function stepDate(view: AgendaView, current: Date, direction: 1 | -1): Date {
  switch (view) {
    case "day":
      return addDays(current, direction);
    case "week":
    case "professional":
      return addDays(current, 7 * direction);
    case "month":
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    case "list":
      return addDays(current, LIST_RANGE_DAYS * direction);
  }
}

const LOCALE = "es-EC";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Etiqueta legible del período actual, p. ej. «12 – 18 oct 2026». */
export function rangeLabel(view: AgendaView, current: Date): string {
  const { from, to } = computeRange(view, current);

  if (view === "day") {
    return capitalize(from.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }
  if (view === "month") {
    return capitalize(from.toLocaleDateString(LOCALE, { month: "long", year: "numeric" }));
  }

  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  if (sameMonth) {
    const month = to.toLocaleDateString(LOCALE, { month: "short", year: "numeric" });
    return `${from.getDate()} – ${to.getDate()} ${month}`;
  }
  const fromLabel = from.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  const toLabel = to.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
  return `${fromLabel} – ${toLabel}`;
}
