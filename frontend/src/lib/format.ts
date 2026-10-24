const LOCALE = "es-EC";
const FALLBACK_CURRENCY = "USD";

/** Importe con la moneda del negocio. Tolera texto del backend y monedas inválidas. */
export function formatCurrency(value: number | string, currency: string = FALLBACK_CURRENCY): string {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(safeAmount);
  } catch {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: FALLBACK_CURRENCY }).format(safeAmount);
  }
}

export interface PercentChange {
  /** Variación redondeada al entero (puede ser negativa). */
  percent: number;
  direction: "up" | "down" | "flat";
}

/**
 * Variación frente al período anterior. Devuelve `null` cuando no hay base de comparación
 * (período anterior en cero): no se inventa un «+∞ %».
 */
export function formatPercentChange(current: number, previous: number): PercentChange | null {
  if (previous === 0) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  const direction = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  return { percent, direction };
}

/** Importe abreviado para ejes de gráficos (p. ej. «$1,2 mil»). */
export function formatCurrencyCompact(value: number, currency: string = FALLBACK_CURRENCY): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
  } catch {
    return String(value);
  }
}

/** «1 cita» / «3 citas». */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
