/** Formato de error uniforme del backend (docs/error-handling.md). */
export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
  request_id: string;
}

/** Sobre de paginación estándar de DRF. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
