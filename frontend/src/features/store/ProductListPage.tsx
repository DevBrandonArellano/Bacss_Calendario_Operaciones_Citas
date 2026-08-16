import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listProducts } from "@/features/store/api";
import { PRODUCT_STATUS_LABELS } from "@/types/store";
import type { Product } from "@/types/store";

export function ProductListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listProducts({ page, status: status || undefined })
      .then((data) => {
        setProducts(data.results);
        setCount(data.count);
      })
      .catch(() => setError("No se pudo cargar la lista de productos."))
      .finally(() => setLoading(false));
  }, [page, status]);

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="toolbar">
        <h1>Productos</h1>
        <Link to="/tienda/productos/nuevo">
          <button type="button">Nuevo producto</button>
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
          {Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p>Cargando...</p>}
      {!loading && products.length === 0 && <p>No hay productos registrados todavía.</p>}

      {!loading && products.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.sku}</td>
                <td>{product.name}</td>
                <td>{product.price}</td>
                <td>
                  {product.stock}{" "}
                  {product.stock <= product.min_stock && (
                    <span className="badge badge-status-awaiting_part">Stock bajo</span>
                  )}
                </td>
                <td>{PRODUCT_STATUS_LABELS[product.status]}</td>
                <td>
                  <Link to={`/tienda/productos/${product.id}/editar`}>Editar / variantes</Link>
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
