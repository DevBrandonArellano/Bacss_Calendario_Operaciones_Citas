import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { listEmployees } from "@/features/employees/api";
import { createLabOrder, listLabOrders, listPatients } from "@/features/laboratory/api";
import { LAB_PROCESS_STATUS_LABELS } from "@/types/laboratory";
import type { LabOrder, LabProcessStatus, LabTestSpec, Patient } from "@/types/laboratory";
import type { Employee } from "@/types/service";

const EMPTY_TEST: LabTestSpec = { test_code: "", test_name: "" };

export function LabOrderListPage() {
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [patientId, setPatientId] = useState("");
  const [orderingEmployeeId, setOrderingEmployeeId] = useState("");
  const [tests, setTests] = useState<LabTestSpec[]>([{ ...EMPTY_TEST }]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function fetchLabOrders() {
    setLoading(true);
    setError(null);
    try {
      const data = await listLabOrders({ page, status: statusFilter || undefined });
      setLabOrders(data.results);
      setCount(data.count);
    } catch {
      setError("No se pudo cargar la lista de pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLabOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  useEffect(() => {
    listPatients({ page: 1 })
      .then((data) => setPatients(data.results))
      .catch(() => setFormError("No se pudo cargar la lista de pacientes."));
    listEmployees({ page: 1 })
      .then((data) => setEmployees(data.results))
      .catch(() => setFormError("No se pudo cargar la lista de profesionales."));
  }, []);

  function updateTest(index: number, field: keyof LabTestSpec, value: string) {
    setTests((prev) => prev.map((test, i) => (i === index ? { ...test, [field]: value } : test)));
  }

  function addTestRow() {
    setTests((prev) => [...prev, { ...EMPTY_TEST }]);
  }

  function removeTestRow(index: number) {
    setTests((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!patientId || !orderingEmployeeId) {
      setFormError("Selecciona un paciente y un profesional que solicita.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await createLabOrder({
        patient_id: patientId,
        ordering_employee_id: orderingEmployeeId,
        tests,
      });
      setPatientId("");
      setOrderingEmployeeId("");
      setTests([{ ...EMPTY_TEST }]);
      setPage(1);
      await fetchLabOrders();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo crear el pedido.";
      setFormError(message);
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));
  const statusOptions = Object.keys(LAB_PROCESS_STATUS_LABELS) as LabProcessStatus[];

  return (
    <div>
      <h1>Pedidos de laboratorio</h1>

      <section aria-labelledby="create-lab-order-heading">
        <h2 id="create-lab-order-heading">Nuevo pedido</h2>
        {formError && (
          <p role="alert" className="form-error">
            {formError}
          </p>
        )}
        <form onSubmit={handleCreate} className="auth-form">
          <label htmlFor="lab-order-patient">Paciente</label>
          <select
            id="lab-order-patient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecciona un paciente
            </option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.first_name} {patient.last_name}
              </option>
            ))}
          </select>

          <label htmlFor="lab-order-employee">Profesional que solicita</label>
          <select
            id="lab-order-employee"
            value={orderingEmployeeId}
            onChange={(e) => setOrderingEmployeeId(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecciona un profesional
            </option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>

          <fieldset>
            <legend>Pruebas</legend>
            {tests.map((test, index) => (
              <div className="toolbar" key={index}>
                <label htmlFor={`test-code-${index}`}>Código</label>
                <input
                  id={`test-code-${index}`}
                  value={test.test_code}
                  onChange={(e) => updateTest(index, "test_code", e.target.value)}
                  required
                />
                <label htmlFor={`test-name-${index}`}>Nombre</label>
                <input
                  id={`test-name-${index}`}
                  value={test.test_name}
                  onChange={(e) => updateTest(index, "test_name", e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => removeTestRow(index)}
                  disabled={tests.length === 1}
                  aria-label={`Quitar prueba ${index + 1}`}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button type="button" onClick={addTestRow}>
              Agregar otra prueba
            </button>
          </fieldset>

          <button type="submit" disabled={creating}>
            {creating ? "Creando..." : "Crear pedido"}
          </button>
        </form>
      </section>

      <section aria-labelledby="lab-orders-list-heading">
        <div className="toolbar">
          <h2 id="lab-orders-list-heading">Historial</h2>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {LAB_PROCESS_STATUS_LABELS[option]}
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
        {!loading && labOrders.length === 0 && <p>No hay pedidos registrados todavía.</p>}

        {!loading && labOrders.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Pruebas</th>
                <th>Solicitado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {labOrders.map((labOrder) => (
                <tr key={labOrder.id}>
                  <td>
                    <span className={`badge badge-status-${labOrder.status}`}>
                      {LAB_PROCESS_STATUS_LABELS[labOrder.status]}
                    </span>
                  </td>
                  <td>{labOrder.tests.length}</td>
                  <td>{new Date(labOrder.ordered_at).toLocaleDateString("es-EC")}</td>
                  <td>
                    <Link to={`/laboratorio/pedidos/${labOrder.id}`}>Ver detalle</Link>
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
