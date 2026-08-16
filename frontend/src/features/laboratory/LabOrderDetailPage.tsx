import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getLabOrder, getPatient } from "@/features/laboratory/api";
import { LAB_PROCESS_STATUS_LABELS } from "@/types/laboratory";
import type { LabOrder, Patient } from "@/types/laboratory";

export function LabOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [labOrder, setLabOrder] = useState<LabOrder | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getLabOrder(id)
      .then((order) => {
        setLabOrder(order);
        return getPatient(order.patient);
      })
      .then(setPatient)
      .catch(() => setError("No se pudo cargar el pedido."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Cargando...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!labOrder) return null;

  return (
    <div>
      <Link to="/laboratorio/pedidos">&larr; Volver a pedidos</Link>
      <div className="toolbar">
        <h1>Pedido de laboratorio</h1>
        <span className={`badge badge-status-${labOrder.status}`}>
          {LAB_PROCESS_STATUS_LABELS[labOrder.status]}
        </span>
      </div>

      {patient && (
        <p>
          Paciente: <strong>{patient.first_name} {patient.last_name}</strong>
          {patient.document_number ? ` · ${patient.document_number}` : ""}
        </p>
      )}

      <h2>Pruebas</h2>
      {labOrder.tests.length === 0 ? (
        <p>Este pedido no tiene pruebas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {labOrder.tests.map((test) => (
              <tr key={test.id}>
                <td>{test.test_code}</td>
                <td>{test.test_name}</td>
                <td>
                  <span className={`badge badge-status-${test.status}`}>
                    {LAB_PROCESS_STATUS_LABELS[test.status]}
                  </span>
                </td>
                <td>
                  <Link to={`/laboratorio/pruebas/${test.id}`}>Gestionar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
