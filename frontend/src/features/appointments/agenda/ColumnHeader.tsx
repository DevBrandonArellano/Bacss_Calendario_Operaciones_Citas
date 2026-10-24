import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";

interface DayHeaderProps {
  date: Date;
  isToday: boolean;
  count: number;
  /** Si se indica, el encabezado es un botón que abre la vista del día. */
  onOpen?: () => void;
}

const WEEKDAY_SHORT = new Intl.DateTimeFormat("es-EC", { weekday: "short" });

export function DayHeader({ date, isToday, count, onOpen }: DayHeaderProps) {
  const weekday = WEEKDAY_SHORT.format(date).replace(".", "");
  const fullLabel = `${date.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}, ${pluralize(count, "cita", "citas")}`;
  const content = (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{weekday}</span>
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full text-base font-bold tabular-nums",
          isToday ? "bg-brand text-on-brand" : "text-ink"
        )}
      >
        {date.getDate()}
      </span>
      <span className="text-xs text-muted">{count > 0 ? pluralize(count, "cita", "citas") : "Libre"}</span>
    </>
  );

  const className = "flex w-full flex-col items-center gap-0.5 px-2 py-2";
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${fullLabel}`}
      aria-current={isToday ? "date" : undefined}
      className={cn(className, "min-h-0 rounded-none border-0 bg-transparent shadow-none hover:bg-subtle")}
    >
      {content}
    </button>
  ) : (
    <div className={className} aria-current={isToday ? "date" : undefined}>
      {content}
    </div>
  );
}

export function EmployeeHeader({ name, specialty, count }: { name: string; specialty?: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2.5 text-center">
      <span className="max-w-full truncate text-sm font-semibold text-ink">{name}</span>
      <span className="max-w-full truncate text-xs text-muted">{specialty || "Profesional"}</span>
      <span className="text-xs text-muted">{count > 0 ? pluralize(count, "cita", "citas") : "Libre"}</span>
    </div>
  );
}
