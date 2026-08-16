import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getCustomerHistory } from "@/features/customers/api";
import { DocumentsPanel } from "@/features/documents/DocumentsPanel";
import { methodLabel, paymentStatusLabel } from "@/features/payments/labels";
import { TasksPanel } from "@/features/tasks/TasksPanel";
import type { CustomerHistory } from "@/types/customer";

export function CustomerHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [history, setHistory] = useState<CustomerHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getCustomerHistory(id)
      .then(setHistory)
      .catch(() => setError("No se pudo cargar el historial del cliente."));
  }, [id]);

  if (error) return <p className="form-error">{error}</p>;
  if (!history) return <p>Cargando...</p>;

  return (
    <div>
      <Link to="/clientes">&larr; Volver a clientes</Link>
      <h1>Historial de {history.full_name}</h1>
      <p>Estado: {history.status === "active" ? "Activo" : "Inactivo"}</p>
      <p>Registrado: {new Date(history.registered_at).toLocaleDateString()}</p>

      <h2>Citas</h2>
      {history.appointments.length === 0 ? <p>Sin citas registradas todavía.</p> : null}

      <div className="toolbar">
        <h2>Pagos</h2>
        <Link to={`/pagos?customer=${history.id}`}>Registrar pago</Link>
      </div>
      {history.payments.length === 0 ? (
        <p>Sin pagos registrados todavía.</p>
      ) : (
        <ul className="notification-list">
          {history.payments.map((payment) => (
            <li key={payment.id} className="notification-item">
              <div className="notification-item-header">
                <span className="notification-item-event">
                  {payment.amount} · {methodLabel(payment.method)}
                </span>
                <span className={`badge badge-status-${payment.status}`}>
                  {paymentStatusLabel(payment.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Documentos</h2>
      <DocumentsPanel ownerType="customer" ownerId={history.id} />

      <h2>Tareas</h2>
      <TasksPanel ownerType="customer" ownerId={history.id} />
    </div>
  );
}
