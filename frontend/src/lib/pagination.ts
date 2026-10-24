import type { Paginated } from "@/types/api";

/** Tamaño máximo de página que acepta el backend (`core/pagination.py`). */
export const MAX_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 10;

export interface AllPagesResult<T> {
  results: T[];
  total: number;
  /** true si el backend tiene más registros de los que se descargaron (tope de seguridad). */
  truncated: boolean;
}

/**
 * Recorre las páginas de un listado paginado hasta completarlo. Evita el error de
 * mostrar «todo» cuando solo se leyó la primera página (20 registros por defecto).
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<Paginated<T>>,
  maxPages: number = DEFAULT_MAX_PAGES
): Promise<AllPagesResult<T>> {
  const first = await fetchPage(1);
  const results = [...first.results];
  let next = first.next;
  let page = 1;

  while (next && page < maxPages) {
    page += 1;
    const data = await fetchPage(page);
    results.push(...data.results);
    next = data.next;
  }

  return { results, total: first.count, truncated: Boolean(next) };
}
