import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { getOrder, transitionOrder } from "@/features/store/api";
import { ORDER_STATUS_LABELS, VALID_ORDER_TRANSITIONS } from "@/types/store";
import type { Order, OrderStatus } from "@/types/store";

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  async function loadOrder(orderId: string) {
    const data = await getOrder(orderId);
    setOrder(data);
  }

  useEffect(() => {
    if (!id) return;
    loadOrder(id)
      .catch(() => setError("No se pudo cargar el pedido."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleTransition(newStatus: OrderStatus) {
    if (!id) return;
    setTransitioning(true);
    setError(null);
    try {
      await transitionOrder(id, newStatus);
      await loadOrder(id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo cambiar el estado.";
      setError(message);
    } finally {
      setTransitioning(false);
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (error && !order) return <p className="form-error">{error}</p>;
  if (!order) return null;

  const nextStatuses = VALID_ORDER_TRANSITIONS[order.status];

  return (
    <div>
      <Link to="/tienda/pedidos">&larr; Volver a pedidos</Link>
      <div className="toolbar">
        <h1>Pedido</h1>
        <span className={`badge badge-status-${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <p>Total: {order.total}</p>

      <h2>Ítems</h2>
      {order.items.length === 0 ? (
        <p>Sin ítems registrados.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Variante</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_variant}</td>
                <td>{item.quantity}</td>
                <td>{item.unit_price}</td>
                <td>{item.subtotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Cambiar estado</h2>
      {nextStatuses.length === 0 ? (
        <p>Este pedido llegó a su estado final.</p>
      ) : (
        <div className="toolbar">
          {nextStatuses.map((status) => (
            <button key={status} type="button" disabled={transitioning} onClick={() => handleTransition(status)}>
              Pasar a: {ORDER_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
