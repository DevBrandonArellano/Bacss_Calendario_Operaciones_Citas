import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { createWorkOrder, listMotorcycles, listWorkOrders } from "@/features/moto/api";
import { WORK_ORDER_STATUS_LABELS } from "@/types/moto";
import type { Motorcycle, WorkOrder, WorkOrderStatus } from "@/types/moto";

export function WorkOrderListPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [motorcycleId, setMotorcycleId] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function fetchWorkOrders() {
    setLoading(true);
    setError(null);
    try {
      const data = await listWorkOrders({ page, status: statusFilter || undefined });
      setWorkOrders(data.results);
      setCount(data.count);
    } catch {
      setError("No se pudo cargar la lista de órdenes de trabajo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  useEffect(() => {
    listMotorcycles({ page: 1 })
      .then((data) => setMotorcycles(data.results))
      .catch(() => setFormError("No se pudo cargar la lista de motos."));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!motorcycleId) {
      setFormError("Selecciona una moto.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await createWorkOrder({ motorcycle_id: motorcycleId, diagnosis_notes: diagnosisNotes });
      setDiagnosisNotes("");
      setMotorcycleId("");
      setPage(1);
      await fetchWorkOrders();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo crear la orden de trabajo.";
      setFormError(message);
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <h1>Órdenes de trabajo</h1>

      <section aria-labelledby="create-work-order-heading">
        <h2 id="create-work-order-heading">Nueva orden de trabajo</h2>
        {formError && (
          <p role="alert" className="form-error">
            {formError}
          </p>
        )}
        <form onSubmit={handleCreate} className="auth-form">
          <label htmlFor="work-order-motorcycle">Moto</label>
          <select
            id="work-order-motorcycle"
            value={motorcycleId}
            onChange={(e) => setMotorcycleId(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecciona una moto
            </option>
            {motorcycles.map((motorcycle) => (
              <option key={motorcycle.id} value={motorcycle.id}>
                {motorcycle.plate} — {motorcycle.brand} {motorcycle.model}
              </option>
            ))}
          </select>

          <label htmlFor="work-order-diagnosis">Notas de diagnóstico (opcional)</label>
          <textarea
            id="work-order-diagnosis"
            value={diagnosisNotes}
            onChange={(e) => setDiagnosisNotes(e.target.value)}
          />

          <button type="submit" disabled={creating}>
            {creating ? "Creando..." : "Crear orden de trabajo"}
          </button>
        </form>
      </section>

      <section aria-labelledby="work-orders-list-heading">
        <div className="toolbar">
          <h2 id="work-orders-list-heading">Historial</h2>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {(Object.keys(WORK_ORDER_STATUS_LABELS) as WorkOrderStatus[]).map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {WORK_ORDER_STATUS_LABELS[statusOption]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {loading && <p>Cargando...</p>}
        {!loading && workOrders.length === 0 && <p>No hay órdenes de trabajo todavía.</p>}

        {!loading && workOrders.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Total</th>
                <th>Recibida</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                  <td>
                    <span className={`badge badge-status-${workOrder.status}`}>
                      {WORK_ORDER_STATUS_LABELS[workOrder.status]}
                    </span>
                  </td>
                  <td>{workOrder.total}</td>
                  <td>{new Date(workOrder.received_at).toLocaleDateString("es-EC")}</td>
                  <td>
                    <Link to={`/ordenes-trabajo/${workOrder.id}`}>Ver detalle</Link>
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
      </section>
    </div>
  );
}
