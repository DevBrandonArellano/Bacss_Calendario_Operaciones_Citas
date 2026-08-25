import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteService, listServices } from "@/features/services/api";
import type { Service } from "@/types/service";

export function ServiceListPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [ordering, setOrdering] = useState("name");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Service | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listServices({ page, ordering, status: status || undefined });
      setServices(data.results);
      setCount(data.count);
    } catch {
      setError("No se pudo cargar la lista de servicios.");
    } finally {
      setLoading(false);
    }
  }, [page, status, ordering]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteService(pendingDelete.id);
      setPendingDelete(null);
      await fetchServices();
    } catch {
      setError("No se pudo eliminar el servicio.");
      setPendingDelete(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="toolbar">
        <h1>Servicios</h1>
        <Link to="/servicios/nuevo">
          <button type="button">Nuevo servicio</button>
        </Link>
      </div>

      <div className="toolbar">
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
        <select value={ordering} onChange={(e) => setOrdering(e.target.value)} aria-label="Ordenar por">
          <option value="name">Nombre (A-Z)</option>
          <option value="-name">Nombre (Z-A)</option>
          <option value="price">Precio (menor a mayor)</option>
          <option value="-price">Precio (mayor a menor)</option>
          <option value="duration_minutes">Duración (menor a mayor)</option>
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Cargando...</p>}
      {!loading && services.length === 0 && <p>No se encontraron servicios.</p>}

      {!loading && services.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Duración</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td>{service.name}</td>
                <td>{service.category || "—"}</td>
                <td>{service.duration_minutes} min</td>
                <td>${service.price}</td>
                <td>{service.status === "active" ? "Activo" : "Inactivo"}</td>
                <td>
                  <Link to={`/servicios/${service.id}/editar`}>Editar</Link>{" "}
                  <button type="button" onClick={() => setPendingDelete(service)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar servicio"
          message={`¿Seguro que deseas eliminar "${pendingDelete.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
