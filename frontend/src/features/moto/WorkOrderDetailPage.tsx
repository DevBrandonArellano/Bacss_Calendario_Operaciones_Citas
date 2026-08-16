import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { addWorkOrderItem, getWorkOrder, transitionWorkOrder } from "@/features/moto/api";
import {
  VALID_WORK_ORDER_TRANSITIONS,
  WORK_ORDER_ITEM_TYPE_LABELS,
  WORK_ORDER_STATUS_LABELS,
} from "@/types/moto";
import type { WorkOrder, WorkOrderItemType, WorkOrderStatus } from "@/types/moto";

const ITEM_TYPE_OPTIONS: WorkOrderItemType[] = ["part", "labor"];

export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const [itemType, setItemType] = useState<WorkOrderItemType>("part");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  async function loadWorkOrder(workOrderId: string) {
    const data = await getWorkOrder(workOrderId);
    setWorkOrder(data);
  }

  useEffect(() => {
    if (!id) return;
    loadWorkOrder(id)
      .catch(() => setError("No se pudo cargar la orden de trabajo."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleTransition(newStatus: WorkOrderStatus) {
    if (!id) return;
    setTransitioning(true);
    setError(null);
    try {
      await transitionWorkOrder(id, newStatus);
      await loadWorkOrder(id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo cambiar el estado.";
      setError(message);
    } finally {
      setTransitioning(false);
    }
  }

  async function handleAddItem(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setAddingItem(true);
    setItemError(null);
    try {
      await addWorkOrderItem(id, {
        item_type: itemType,
        description,
        quantity: Number(quantity),
        unit_price: unitPrice,
      });
      setDescription("");
      setQuantity("1");
      setUnitPrice("");
      await loadWorkOrder(id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo agregar el ítem.";
      setItemError(message);
    } finally {
      setAddingItem(false);
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (error && !workOrder) return <p className="form-error">{error}</p>;
  if (!workOrder) return null;

  const nextStatuses = VALID_WORK_ORDER_TRANSITIONS[workOrder.status];

  return (
    <div>
      <Link to="/ordenes-trabajo">&larr; Volver a órdenes de trabajo</Link>
      <div className="toolbar">
        <h1>Orden de trabajo</h1>
        <span className={`badge badge-status-${workOrder.status}`}>
          {WORK_ORDER_STATUS_LABELS[workOrder.status]}
        </span>
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <p>Total: {workOrder.total}</p>
      {workOrder.diagnosis_notes && <p>Diagnóstico: {workOrder.diagnosis_notes}</p>}

      <h2>Cambiar estado</h2>
      {nextStatuses.length === 0 ? (
        <p>Esta orden llegó a su estado final.</p>
      ) : (
        <div className="toolbar">
          {nextStatuses.map((status) => (
            <button
              key={status}
              type="button"
              disabled={transitioning}
              onClick={() => handleTransition(status)}
            >
              Pasar a: {WORK_ORDER_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}

      <h2>Ítems</h2>
      {workOrder.items.length === 0 ? (
        <p>Sin ítems registrados todavía.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {workOrder.items.map((item) => (
              <tr key={item.id}>
                <td>{WORK_ORDER_ITEM_TYPE_LABELS[item.item_type]}</td>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{item.unit_price}</td>
                <td>{item.subtotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Agregar ítem</h3>
      {itemError && (
        <p role="alert" className="form-error">
          {itemError}
        </p>
      )}
      <form onSubmit={handleAddItem} className="auth-form">
        <label htmlFor="item-type">Tipo</label>
        <select
          id="item-type"
          value={itemType}
          onChange={(e) => setItemType(e.target.value as WorkOrderItemType)}
        >
          {ITEM_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {WORK_ORDER_ITEM_TYPE_LABELS[option]}
            </option>
          ))}
        </select>

        <label htmlFor="item-description">Descripción</label>
        <input
          id="item-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <label htmlFor="item-quantity">Cantidad</label>
        <input
          id="item-quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />

        <label htmlFor="item-unit-price">Precio unitario</label>
        <input
          id="item-unit-price"
          type="number"
          min="0"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          required
        />

        <button type="submit" disabled={addingItem}>
          {addingItem ? "Agregando..." : "Agregar ítem"}
        </button>
      </form>
    </div>
  );
}
