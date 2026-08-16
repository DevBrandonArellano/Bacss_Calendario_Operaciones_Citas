import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteCustomer, listCustomers } from "@/features/customers/api";
import type { Customer } from "@/types/customer";

const PAGE_SIZE_ORDERINGS = [
  { value: "last_name", label: "Apellido (A-Z)" },
  { value: "-last_name", label: "Apellido (Z-A)" },
  { value: "-registered_at", label: "Más recientes primero" },
];

export function CustomerListPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [ordering, setOrdering] = useState("last_name");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);

  async function fetchCustomers() {
    setLoading(true);
    setError(null);
    try {
      const data = await listCustomers({
        page,
        ordering: query ? undefined : ordering,
        status: status || undefined,
        q: query || undefined,
      });
      setCustomers(data.results);
      setCount(data.count);
    } catch {
      setError("No se pudo cargar la lista de clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, ordering, query]);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteCustomer(pendingDelete.id);
      setPendingDelete(null);
      await fetchCustomers();
    } catch {
      setError("No se pudo eliminar el cliente.");
      setPendingDelete(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="toolbar">
        <h1>Clientes</h1>
        <Link to="/clientes/nuevo">
          <button type="button">Nuevo cliente</button>
        </Link>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Buscar por nombre, documento, teléfono o email"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          aria-label="Buscar clientes"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        <select
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
          disabled={Boolean(query)}
          aria-label="Ordenar por"
        >
          {PAGE_SIZE_ORDERINGS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Cargando...</p>}

      {!loading && customers.length === 0 && <p>No se encontraron clientes.</p>}

      {!loading && customers.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.full_name}</td>
                <td>{customer.document_number || "—"}</td>
                <td>{customer.phone || "—"}</td>
                <td>{customer.email || "—"}</td>
                <td>{customer.status === "active" ? "Activo" : "Inactivo"}</td>
                <td>
                  <Link to={`/clientes/${customer.id}/historial`}>Historial</Link>{" "}
                  <Link to={`/clientes/${customer.id}/editar`}>Editar</Link>{" "}
                  <button type="button" onClick={() => setPendingDelete(customer)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!query && (
        <div className="pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar cliente"
          message={`¿Seguro que deseas eliminar a ${pendingDelete.full_name}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
