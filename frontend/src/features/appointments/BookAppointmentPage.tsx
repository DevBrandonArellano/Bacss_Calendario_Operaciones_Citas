import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import { createAppointment, getAvailability } from "@/features/appointments/api";
import { listCustomers } from "@/features/customers/api";
import { listServices } from "@/features/services/api";
import { listBranches } from "@/features/branches/api";
import { toISODate } from "@/lib/dates";
import type { AvailabilitySlot } from "@/types/appointment";
import type { Branch } from "@/types/branch";
import type { Customer } from "@/types/customer";
import type { Service } from "@/types/service";

export function BookAppointmentPage() {
  const navigate = useNavigate();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [branchId, setBranchId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(toISODate(new Date()));

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listBranches({ page: 1 }).then((data) => setBranches(data.results));
    listServices({ page: 1, ordering: "name" }).then((data) => setServices(data.results));
  }, []);

  useEffect(() => {
    if (!customerQuery) {
      setCustomerResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      listCustomers({ page: 1, q: customerQuery }).then((data) => setCustomerResults(data.results));
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerQuery]);

  useEffect(() => {
    if (!branchId || !serviceId || !date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setError(null);
    getAvailability({ service_id: serviceId, branch_id: branchId, date })
      .then((data) => setSlots(data.slots))
      .catch(() => setError("No se pudo cargar la disponibilidad."))
      .finally(() => setLoadingSlots(false));
  }, [branchId, serviceId, date]);

  async function handleConfirm() {
    if (!selectedSlot || !customerId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createAppointment({
        customer_id: customerId,
        service_id: serviceId,
        employee_id: selectedSlot.employee_id,
        branch_id: branchId,
        appointment_date: date,
        start_time: selectedSlot.start_time,
        booking_channel: "staff",
      });
      navigate("/citas");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo crear la cita.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Nueva cita</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <div className="auth-form">
        <label htmlFor="customer-search">Cliente</label>
        <input
          id="customer-search"
          placeholder="Buscar por nombre, documento o teléfono"
          value={customerLabel || customerQuery}
          onChange={(e) => {
            setCustomerLabel("");
            setCustomerId("");
            setCustomerQuery(e.target.value);
          }}
        />
        {customerResults.length > 0 && !customerId && (
          <ul>
            {customerResults.map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerId(customer.id);
                    setCustomerLabel(customer.full_name);
                    setCustomerResults([]);
                  }}
                >
                  {customer.full_name} — {customer.document_number || "sin documento"}
                </button>
              </li>
            ))}
          </ul>
        )}

        <label htmlFor="branch">Sucursal</label>
        <select id="branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">Selecciona una sucursal</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <label htmlFor="service">Servicio</label>
        <select id="service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Selecciona un servicio</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.duration_minutes} min)
            </option>
          ))}
        </select>

        <label htmlFor="date">Fecha</label>
        <input
          id="date"
          type="date"
          value={date}
          min={toISODate(new Date())}
          onChange={(e) => setDate(e.target.value)}
        />

        {loadingSlots && <p>Buscando horarios disponibles...</p>}
        {!loadingSlots && branchId && serviceId && slots.length === 0 && <p>No hay horarios disponibles ese día.</p>}
        {!loadingSlots && slots.length > 0 && (
          <>
            <p>Horarios disponibles (no se pueden seleccionar horarios ocupados):</p>
            <div className="toolbar" role="list" aria-label="Horarios disponibles">
              {slots.map((slot) => (
                <button
                  key={`${slot.employee_id}-${slot.start_time}`}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  disabled={
                    selectedSlot?.employee_id === slot.employee_id &&
                    selectedSlot?.start_time === slot.start_time
                  }
                >
                  {slot.start_time.slice(0, 5)}
                  {selectedSlot?.employee_id === slot.employee_id &&
                  selectedSlot?.start_time === slot.start_time
                    ? " ✓"
                    : ""}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="toolbar">
          <button type="button" disabled={!selectedSlot || !customerId || submitting} onClick={handleConfirm}>
            {submitting ? "Reservando..." : "Confirmar reserva"}
          </button>
          <button type="button" onClick={() => navigate("/citas")}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
