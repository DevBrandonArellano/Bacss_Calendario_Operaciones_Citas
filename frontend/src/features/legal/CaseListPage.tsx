import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "@/api/client";
import { listCustomers } from "@/features/customers/api";
import { listEmployees } from "@/features/employees/api";
import { createLegalCase, listLegalCases } from "@/features/legal/api";
import { CASE_PRIORITY_LABELS, LEGAL_CASE_STATUS_LABELS } from "@/types/legal";
import type { CasePriority, LegalCase, LegalCaseStatus } from "@/types/legal";
import type { Customer } from "@/types/customer";
import type { Employee } from "@/types/service";

const PRIORITY_OPTIONS: CasePriority[] = ["low", "medium", "high"];

export function CaseListPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [lawyers, setLawyers] = useState<Employee[]>([]);
  const [caseNumber, setCaseNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [caseType, setCaseType] = useState("");
  const [lawyerId, setLawyerId] = useState("");
  const [priority, setPriority] = useState<CasePriority>("medium");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listLegalCases({ page, status: statusFilter || undefined });
      setCases(data.results);
      setCount(data.count);
    } catch {
      setError("No se pudo cargar la lista de casos.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    listCustomers({ page: 1 })
      .then((data) => setCustomers(data.results))
      .catch(() => setFormError("No se pudo cargar la lista de clientes."));
    listEmployees({ page: 1 })
      .then((data) => setLawyers(data.results))
      .catch(() => setFormError("No se pudo cargar la lista de profesionales."));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!customerId || !lawyerId) {
      setFormError("Selecciona un cliente y un abogado responsable.");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await createLegalCase({
        case_number: caseNumber,
        customer_id: customerId,
        case_type: caseType,
        responsible_lawyer_id: lawyerId,
        priority,
      });
      setCaseNumber("");
      setCustomerId("");
      setCaseType("");
      setLawyerId("");
      setPriority("medium");
      setPage(1);
      await fetchCases();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo crear el caso.";
      setFormError(message);
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));
  const statusOptions = Object.keys(LEGAL_CASE_STATUS_LABELS) as LegalCaseStatus[];

  return (
    <div>
      <h1>Casos</h1>

      <section aria-labelledby="create-case-heading">
        <h2 id="create-case-heading">Nuevo caso</h2>
        {formError && (
          <p role="alert" className="form-error">
            {formError}
          </p>
        )}
        <form onSubmit={handleCreate} className="auth-form">
          <label htmlFor="case-number">Número de caso</label>
          <input id="case-number" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} required />

          <label htmlFor="case-customer">Cliente</label>
          <select id="case-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="" disabled>
              Selecciona un cliente
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name}
              </option>
            ))}
          </select>

          <label htmlFor="case-type">Tipo de caso</label>
          <input id="case-type" value={caseType} onChange={(e) => setCaseType(e.target.value)} required />

          <label htmlFor="case-lawyer">Abogado responsable</label>
          <select id="case-lawyer" value={lawyerId} onChange={(e) => setLawyerId(e.target.value)} required>
            <option value="" disabled>
              Selecciona un abogado
            </option>
            {lawyers.map((lawyer) => (
              <option key={lawyer.id} value={lawyer.id}>
                {lawyer.full_name}
              </option>
            ))}
          </select>

          <label htmlFor="case-priority">Prioridad</label>
          <select
            id="case-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as CasePriority)}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {CASE_PRIORITY_LABELS[option]}
              </option>
            ))}
          </select>

          <button type="submit" disabled={creating}>
            {creating ? "Creando..." : "Crear caso"}
          </button>
        </form>
      </section>

      <section aria-labelledby="cases-list-heading">
        <div className="toolbar">
          <h2 id="cases-list-heading">Historial</h2>
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
                {LEGAL_CASE_STATUS_LABELS[option]}
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
        {!loading && cases.length === 0 && <p>No hay casos registrados todavía.</p>}

        {!loading && cases.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Tipo</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((legalCase) => (
                <tr key={legalCase.id}>
                  <td>{legalCase.case_number}</td>
                  <td>{legalCase.case_type}</td>
                  <td>{CASE_PRIORITY_LABELS[legalCase.priority]}</td>
                  <td>
                    <span className={`badge badge-status-${legalCase.status}`}>
                      {LEGAL_CASE_STATUS_LABELS[legalCase.status]}
                    </span>
                  </td>
                  <td>
                    <Link to={`/legal/casos/${legalCase.id}`}>Ver detalle</Link>
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
