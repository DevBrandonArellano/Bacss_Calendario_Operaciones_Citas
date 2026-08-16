import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listMotorcycles } from "@/features/moto/api";
import type { Motorcycle } from "@/types/moto";

export function MotorcycleListPage() {
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listMotorcycles({ page })
      .then((data) => {
        setMotorcycles(data.results);
        setCount(data.count);
      })
      .catch(() => setError("No se pudo cargar la lista de motos."))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="toolbar">
        <h1>Motos</h1>
        <Link to="/motos/nueva">
          <button type="button">Nueva moto</button>
        </Link>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p>Cargando...</p>}
      {!loading && motorcycles.length === 0 && <p>No hay motos registradas todavía.</p>}

      {!loading && motorcycles.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Placa</th>
              <th>Marca / Modelo</th>
              <th>Año</th>
              <th>Kilometraje</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {motorcycles.map((motorcycle) => (
              <tr key={motorcycle.id}>
                <td>{motorcycle.plate}</td>
                <td>
                  {motorcycle.brand} {motorcycle.model}
                </td>
                <td>{motorcycle.year ?? "—"}</td>
                <td>{motorcycle.mileage} km</td>
                <td>
                  <Link to={`/motos/${motorcycle.id}/historial`}>Historial</Link>{" "}
                  <Link to={`/motos/${motorcycle.id}/editar`}>Editar</Link>
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
    </div>
  );
}
