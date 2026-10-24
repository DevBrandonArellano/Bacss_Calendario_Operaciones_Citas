export interface BusinessNow {
  /** Fecha local del negocio, «YYYY-MM-DD». */
  date: string;
  /** Minutos transcurridos desde la medianoche local del negocio. */
  minutes: number;
}

const FALLBACK_TIME_ZONE = "America/Guayaquil";

/**
 * «Ahora» en la zona horaria del negocio. Las citas se guardan como fecha y hora locales del
 * negocio, así que «hoy» y la línea de hora actual no deben depender de la zona del navegador.
 */
export function nowInTimeZone(timeZone: string | undefined, now: Date = new Date()): BusinessNow {
  const zone = timeZone || FALLBACK_TIME_ZONE;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return nowInTimeZone(FALLBACK_TIME_ZONE, now);
  }
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}
