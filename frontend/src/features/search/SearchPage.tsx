import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { globalSearch } from "@/features/search/api";
import { SEARCH_RESULT_TYPE_LABELS, searchResultPath } from "@/types/search";
import type { SearchResult } from "@/types/search";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await globalSearch(q);
      setResults(data);
      setSearched(true);
    } catch {
      setError("No se pudo completar la búsqueda.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Depende de `initialQuery` y no solo del montaje: llegar a /buscar?q=B desde
  // /buscar?q=A no desmonta la pantalla, y sin esto seguiría mostrando A.
  useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
  }, [initialQuery, runSearch]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSearchParams(query ? { q: query } : {});
    runSearch(query);
  }

  return (
    <div>
      <h1>Búsqueda</h1>

      <form onSubmit={handleSubmit} className="toolbar">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar clientes, citas, motos, casos, pedidos, documentos..."
          aria-label="Texto a buscar"
        />
        <button type="submit">Buscar</button>
      </form>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading && <p>Buscando...</p>}
      {!loading && searched && results.length === 0 && <p>No se encontraron resultados.</p>}

      {!loading && results.length > 0 && (
        <ul className="notification-list">
          {results.map((result) => {
            const path = searchResultPath(result);
            return (
              <li key={`${result.type}-${result.id}`} className="notification-item">
                <div className="notification-item-header">
                  <span className="badge">{SEARCH_RESULT_TYPE_LABELS[result.type]}</span>
                  <span className="notification-item-event">
                    {path ? <Link to={path}>{result.label}</Link> : result.label}
                  </span>
                </div>
                {result.detail && <p className="notification-item-body">{result.detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
