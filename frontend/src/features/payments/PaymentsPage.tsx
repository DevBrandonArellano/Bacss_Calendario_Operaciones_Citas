import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { listAppointments } from "@/features/appointments/api";
import { getCustomer, listCustomers } from "@/features/customers/api";
import { methodLabel, paymentStatusLabel } from "@/features/payments/labels";
import { createPayment, listPayments, refundPayment } from "@/features/payments/api";
import type { Appointment } from "@/types/appointment";
import type { Customer } from "@/types/customer";
import type { Payment, PaymentMethod } from "@/types/payment";

const METHOD_OPTIONS: PaymentMethod[] = ["cash", "transfer", "card", "other"];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaymentsPage() {
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get("customer");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerAppointments, setCustomerAppointments] = useState<Appointment[]>([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listPayments({
        page,
        status: statusFilter || undefined,
        customer: selectedCustomer?.id ?? preselectedCustomerId ?? undefined,
      });
      setPayments(data.results);
      setCount(data.count);
    } catch {
      setListError("No se pudo cargar la lista de pagos.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, selectedCustomer, preselectedCustomerId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (!preselectedCustomerId) return;
    getCustomer(preselectedCustomerId)
      .then(setSelectedCustomer)
      .catch(() => setFormError("No se pudo cargar el cliente indicado."));
  }, [preselectedCustomerId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerAppointments([]);
      return;
    }
    listAppointments({ customer: selectedCustomer.id })
      .then((data) => setCustomerAppointments(data.results))
      .catch(() => setCustomerAppointments([]));
  }, [selectedCustomer]);

  async function handleSearchCustomers() {
    if (!customerQuery.trim()) return;
    try {
      const data = await listCustomers({ q: customerQuery });
      setCustomerResults(data.results);
    } catch {
      setFormError("No se pudo buscar clientes.");
    }
  }

  function handleSelectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setCustomerResults([]);
    setCustomerQuery("");
    setAppointmentId("");
    setPage(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedCustomer) {
      setFormError("Selecciona un cliente antes de registrar el pago.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setFormError("Ingresa un monto mayor a cero.");
      return;
    }

    setSubmitting(true);
    try {
      await createPayment({
        customer_id: selectedCustomer.id,
        appointment_id: appointmentId || null,
        amount,
        method,
      });
      setAmount("");
      setAppointmentId("");
      setPage(1);
      await fetchPayments();
    } catch {
      setFormError("No se pudo registrar el pago.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefund(payment: Payment) {
    setRefundingId(payment.id);
    try {
      await refundPayment(payment.id);
      await fetchPayments();
    } catch {
      setListError("No se pudo reembolsar el pago.");
    } finally {
      setRefundingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <h1>Pagos</h1>

      <section aria-labelledby="register-payment-heading">
        <h2 id="register-payment-heading">Registrar pago</h2>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        {selectedCustomer ? (
          <div className="toolbar">
            <span>
              Cliente: <strong>{selectedCustomer.full_name}</strong>
            </span>
            <button type="button" onClick={() => setSelectedCustomer(null)}>
              Cambiar cliente
            </button>
          </div>
        ) : (
          <div className="toolbar">
            <input
              type="search"
              placeholder="Buscar cliente por nombre, documento, teléfono o email"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              aria-label="Buscar cliente para registrar pago"
            />
            <button type="button" onClick={handleSearchCustomers}>
              Buscar
            </button>
          </div>
        )}

        {customerResults.length > 0 && (
          <ul className="notification-list">
            {customerResults.map((customer) => (
              <li key={customer.id} className="notification-item">
                <button type="button" onClick={() => handleSelectCustomer(customer)}>
                  {customer.full_name} {customer.document_number ? `· ${customer.document_number}` : ""}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selectedCustomer && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="payment-appointment">Cita relacionada (opcional)</label>
            <select
              id="payment-appointment"
              value={appointmentId}
              onChange={(e) => setAppointmentId(e.target.value)}
            >
              <option value="">Sin cita asociada</option>
              {customerAppointments.map((appt) => (
                <option key={appt.id} value={appt.id}>
                  {appt.appointment_date} {appt.start_time} — {appt.status}
                </option>
              ))}
            </select>

            <label htmlFor="payment-amount">Monto</label>
            <input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />

            <label htmlFor="payment-method">Método</label>
            <select
              id="payment-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {methodLabel(option)}
                </option>
              ))}
            </select>

            <button type="submit" disabled={submitting}>
              {submitting ? "Registrando..." : "Registrar pago"}
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="payments-list-heading">
        <div className="toolbar">
          <h2 id="payments-list-heading">Historial</h2>
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            <option value="paid">Pagado</option>
            <option value="refunded">Reembolsado</option>
          </select>
        </div>

        {listError && (
          <p className="form-error" role="alert">
            {listError}
          </p>
        )}
        {loading && <p>Cargando...</p>}
        {!loading && payments.length === 0 && <p>No hay pagos registrados todavía.</p>}

        {!loading && payments.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Cita</th>
                <th>Monto</th>
                <th>Método</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.customer_name}</td>
                  <td>{payment.appointment_date ?? "—"}</td>
                  <td>{payment.amount}</td>
                  <td>{methodLabel(payment.method)}</td>
                  <td>
                    <span className={`badge badge-status-${payment.status}`}>
                      {paymentStatusLabel(payment.status)}
                    </span>
                  </td>
                  <td>{formatDateTime(payment.created_at)}</td>
                  <td>
                    {payment.status === "paid" && (
                      <button
                        type="button"
                        onClick={() => handleRefund(payment)}
                        disabled={refundingId === payment.id}
                      >
                        Reembolsar
                      </button>
                    )}
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
