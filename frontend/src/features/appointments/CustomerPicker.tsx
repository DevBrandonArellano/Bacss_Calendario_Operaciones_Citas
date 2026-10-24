import { Search, UserPlus, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { listCustomers } from "@/features/customers/api";
import type { Customer } from "@/types/customer";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export interface PickedCustomer {
  id: string;
  label: string;
}

interface CustomerPickerProps {
  value: PickedCustomer | null;
  error?: string | null;
  canRegister: boolean;
  onChange: (customer: PickedCustomer | null) => void;
}

/**
 * Busca clientes por nombre, documento o teléfono sin cargar todo el listado (búsqueda en el
 * servidor con espera de 300 ms entre pulsaciones). Una vez elegido, muestra el cliente con la
 * opción de cambiarlo.
 */
export function CustomerPicker({ value, error, canRegister, onChange }: CustomerPickerProps) {
  const inputId = useId();
  const messageId = `${inputId}-msg`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      listCustomers({ page: 1, q: query.trim() })
        .then((data) => {
          if (cancelled) return;
          setResults(data.results);
          setSearchFailed(false);
        })
        .catch(() => {
          if (!cancelled) setSearchFailed(true);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-muted">Cliente seleccionado</p>
          <p className="m-0 truncate text-sm font-semibold text-ink">{value.label}</p>
        </div>
        <Button size="sm" onClick={() => onChange(null)}>
          <X className="size-4" aria-hidden="true" />
          Cambiar
        </Button>
      </div>
    );
  }

  const showEmpty = !searching && !searchFailed && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="sr-only">
        Cliente
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          className="w-full pl-9"
          placeholder="Buscar por nombre, documento o teléfono"
          autoComplete="off"
          value={query}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? messageId : undefined}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div aria-live="polite" className="text-sm text-muted">
        {searching && "Buscando clientes..."}
        {searchFailed && "No se pudo buscar clientes. Inténtalo de nuevo."}
        {showEmpty && "No se encontraron clientes con ese dato."}
      </div>

      {results.length > 0 && (
        <ul className="m-0 flex max-h-60 list-none flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface p-0">
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="flex w-full flex-col items-start rounded-none border-0 bg-transparent px-4 py-2.5 text-left shadow-none hover:bg-subtle"
                onClick={() => {
                  onChange({ id: customer.id, label: customer.full_name });
                  setQuery("");
                  setResults([]);
                }}
              >
                <span className="text-sm font-semibold text-ink">{customer.full_name}</span>
                <span className="text-xs text-muted">
                  {customer.document_number || "Sin documento"}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p id={messageId} className="m-0 text-sm text-negative">
          {error}
        </p>
      )}

      {canRegister && (
        <p className="m-0 text-sm text-muted">
          <UserPlus className="mr-1 inline size-4" aria-hidden="true" />
          ¿Cliente nuevo?{" "}
          <a href="/clientes/nuevo" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            Regístralo en otra pestaña
          </a>{" "}
          (así no pierdes esta cita) y vuelve a buscarlo aquí.
        </p>
      )}
    </div>
  );
}
