import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { agendaLink } from "@/features/appointments/agenda/agendaUrl";
import { createAppointment, getAvailability } from "@/features/appointments/api";
import { BookingSummary } from "@/features/appointments/BookingSummary";
import {
  employeesForService,
  matchSlot,
  servicesForBranch,
  validateBooking,
  type BookingField,
} from "@/features/appointments/bookingRules";
import { CustomerPicker, type PickedCustomer } from "@/features/appointments/CustomerPicker";
import { SlotPicker } from "@/features/appointments/SlotPicker";
import { useAuth } from "@/features/auth/useAuth";
import { listBranches } from "@/features/branches/api";
import { listEmployees } from "@/features/employees/api";
import { listServices } from "@/features/services/api";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useBusinessNow } from "@/hooks/useBusinessNow";
import { errorMessage, isConflict } from "@/lib/errors";
import { MAX_PAGE_SIZE, fetchAllPages } from "@/lib/pagination";
import type { AvailabilitySlot } from "@/types/appointment";

const ANY_EMPLOYEE = "";
const CONFLICT_MESSAGE = "Ese horario ya no está disponible. Elige otro de la lista actualizada.";

const loadBranches = () =>
  fetchAllPages((page) => listBranches({ page })).then((result) => result.results.filter((b) => b.is_active));
const loadServices = () =>
  fetchAllPages((page) => listServices({ page, page_size: MAX_PAGE_SIZE, ordering: "name" })).then((result) => result.results);
const loadEmployees = () =>
  fetchAllPages((page) => listEmployees({ page, page_size: MAX_PAGE_SIZE, is_active: true })).then((result) => result.results);

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-base font-semibold text-ink">{title}</h2>
        {description && <p className="m-0 mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Formulario «Nueva cita» por grupos: cliente, servicio, profesional, fecha/horario e información adicional. */
export function BookAppointmentPage() {
  const navigate = useNavigate();
  const { organization, can } = useAuth();
  const now = useBusinessNow(organization?.timezone);
  const [searchParams] = useSearchParams();

  // Valores precargados desde la Agenda (clic en un hueco libre) o desde otras pantallas.
  const [prefillTime, setPrefillTime] = useState(searchParams.get("time") ?? "");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [branchId, setBranchId] = useState("");
  const [serviceId, setServiceId] = useState(searchParams.get("service") ?? "");
  const [employeeId, setEmployeeId] = useState(searchParams.get("employee") ?? ANY_EMPLOYEE);
  const [date, setDate] = useState(searchParams.get("date") ?? now.date);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [branches] = useAsyncResource(useCallback(loadBranches, []));
  const [allServices] = useAsyncResource(useCallback(loadServices, []));
  const [allEmployees] = useAsyncResource(useCallback(loadEmployees, []));

  const branchList = useMemo(() => (branches.status === "ready" ? branches.data : []), [branches]);
  const employeeList = useMemo(() => (allEmployees.status === "ready" ? allEmployees.data : []), [allEmployees]);
  const serviceOptions = useMemo(
    () => servicesForBranch(allServices.status === "ready" ? allServices.data : [], branchId),
    [allServices, branchId]
  );
  const employeeOptions = useMemo(
    () => employeesForService(employeeList, serviceId, branchId),
    [employeeList, serviceId, branchId]
  );
  const service = serviceOptions.find((s) => s.id === serviceId) ?? null;

  // Con una sola sucursal (o la del profesional precargado) no hace falta preguntarla.
  useEffect(() => {
    if (branchId || branchList.length === 0) return;
    const preselected = employeeList.find((e) => e.id === employeeId)?.branch;
    if (preselected) setBranchId(preselected);
    else if (branchList.length === 1) setBranchId(branchList[0].id);
  }, [branchId, branchList, employeeList, employeeId]);

  const loadSlots = useCallback(
    () =>
      getAvailability({
        service_id: serviceId,
        branch_id: branchId,
        date,
        employee_id: employeeId || undefined,
      }).then((response) => response.slots),
    [serviceId, branchId, date, employeeId]
  );
  const [slots, reloadSlots] = useAsyncResource(loadSlots, Boolean(serviceId && branchId && date));

  // Al cambiar servicio/profesional/fecha el horario elegido deja de ser válido.
  useEffect(() => setSlot(null), [serviceId, branchId, date, employeeId]);

  // Preselecciona el horario que venía en la URL, si sigue libre; solo una vez.
  useEffect(() => {
    if (!prefillTime || slots.status !== "ready") return;
    const match = matchSlot(slots.data, prefillTime, employeeId);
    if (match) setSlot(match);
    setPrefillTime("");
  }, [slots, prefillTime, employeeId]);

  const errors = submitted
    ? validateBooking({ customerId: customer?.id ?? "", branchId, serviceId, hasSlot: slot !== null })
    : ({} as Partial<Record<BookingField, string>>);

  const employeeNames = useMemo(
    () => Object.fromEntries(employeeList.map((e) => [e.id, e.full_name])),
    [employeeList]
  );
  const slotList = slots.status === "ready" ? slots.data : [];
  const chosenEmployeeName = slot ? employeeNames[slot.employee_id] ?? null : employeeId ? employeeNames[employeeId] ?? null : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitted(true);
    setFormError(null);
    const problems = validateBooking({ customerId: customer?.id ?? "", branchId, serviceId, hasSlot: slot !== null });
    if (Object.keys(problems).length > 0 || !customer || !slot) return;

    setSubmitting(true);
    try {
      const created = await createAppointment({
        customer_id: customer.id,
        service_id: serviceId,
        employee_id: slot.employee_id,
        branch_id: branchId,
        appointment_date: date,
        start_time: slot.start_time,
        notes: notes.trim(),
        booking_channel: "staff",
        requires_confirmation: needsConfirmation,
      });
      navigate(agendaLink({ view: "day", date, appointment: created.id }), {
        state: { notice: { tone: "success", text: "Cita creada correctamente." } },
      });
    } catch (error) {
      if (isConflict(error)) {
        // Otra persona tomó el horario mientras tanto: se conserva lo escrito y se refresca la lista.
        setFormError(errorMessage(error, CONFLICT_MESSAGE));
        setSlot(null);
        reloadSlots();
      } else {
        setFormError(errorMessage(error, "No se pudo crear la cita. Inténtalo de nuevo."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const timeZone = organization?.timezone ?? "America/Guayaquil";
  const currency = organization?.currency ?? "USD";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PageHeader title="Nueva cita" description="Completa los datos y elige un horario disponible." />

      {formError && (
        <p role="alert" className="form-error mb-4">
          {formError}
        </p>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-8">
          <Section title="1. Cliente">
            <CustomerPicker value={customer} error={errors.customer} canRegister={can("customers:write")} onChange={setCustomer} />
          </Section>

          <Section title="2. Servicio" description="El servicio determina la duración y qué profesionales pueden atender.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sucursal" error={errors.branch}>
                {(control) => (
                  <select
                    {...control}
                    value={branchId}
                    onChange={(event) => {
                      setBranchId(event.target.value);
                      setServiceId("");
                    }}
                  >
                    <option value="">Selecciona una sucursal</option>
                    {branchList.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Servicio" error={errors.service}>
                {(control) => (
                  <select
                    {...control}
                    value={serviceId}
                    onChange={(event) => {
                      const nextServiceId = event.target.value;
                      setServiceId(nextServiceId);
                      // Se conserva el profesional elegido (p. ej. precargado desde la Agenda) si ofrece el nuevo servicio.
                      const keepsEmployee = employeeList.find((e) => e.id === employeeId)?.services.includes(nextServiceId);
                      if (!keepsEmployee) setEmployeeId(ANY_EMPLOYEE);
                    }}
                  >
                    <option value="">Selecciona un servicio</option>
                    {serviceOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} ({option.duration_minutes} min)
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </Section>

          <Section title="3. Profesional" description="Elige a quién atenderá o deja que el sistema muestre todos los disponibles.">
            <Field label="Profesional">
              {(control) => (
                <select
                  {...control}
                  value={employeeId}
                  disabled={!serviceId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                >
                  <option value={ANY_EMPLOYEE}>{serviceId ? "Cualquiera disponible" : "Primero elige un servicio"}</option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name}
                      {employee.specialty ? ` · ${employee.specialty}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </Section>

          <Section title="4. Fecha y horario">
            <Field label="Fecha">
              {(control) => (
                <input
                  {...control}
                  type="date"
                  className="sm:max-w-56"
                  value={date}
                  min={now.date}
                  onChange={(event) => setDate(event.target.value)}
                />
              )}
            </Field>

            <div aria-live="polite" aria-busy={slots.status === "loading"}>
              {!serviceId || !branchId ? (
                <p className="m-0 rounded-xl bg-subtle px-4 py-3 text-sm text-muted">
                  Elige la sucursal y el servicio para ver los horarios disponibles.
                </p>
              ) : slots.status === "loading" ? (
                <p className="m-0 text-sm text-muted">Buscando horarios disponibles...</p>
              ) : slots.status === "error" ? (
                <p role="alert" className="form-error">
                  No se pudo cargar la disponibilidad.{" "}
                  <button type="button" className="min-h-0 border-0 bg-transparent p-0 font-semibold underline shadow-none" onClick={reloadSlots}>
                    Reintentar
                  </button>
                </p>
              ) : slotList.length === 0 ? (
                <p className="m-0 rounded-xl bg-subtle px-4 py-3 text-sm text-muted">
                  No hay horarios disponibles ese día. Prueba con otra fecha{employeeId ? " u otro profesional" : ""}.
                </p>
              ) : (
                <SlotPicker
                  slots={slotList}
                  selected={slot}
                  employeeNames={employeeNames}
                  showEmployeeNames={new Set(slotList.map((s) => s.employee_id)).size > 1}
                  onSelect={setSlot}
                />
              )}
            </div>
            {errors.slot && <p className="m-0 text-sm text-negative">{errors.slot}</p>}
          </Section>

          <Section title="5. Información adicional">
            <Field label="Notas internas (opcional)" hint="Solo las ve el personal del negocio.">
              {(control) => (
                <textarea {...control} rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
              )}
            </Field>
            <Field label="Estado inicial de la cita">
              {(control) => (
                <select
                  {...control}
                  className="sm:max-w-72"
                  value={needsConfirmation ? "pending" : "confirmed"}
                  onChange={(event) => setNeedsConfirmation(event.target.value === "pending")}
                >
                  <option value="confirmed">Confirmada</option>
                  <option value="pending">Pendiente de confirmación</option>
                </select>
              )}
            </Field>
            <p className="m-0 text-sm text-muted">Origen de la reserva: personal del negocio.</p>
          </Section>
        </div>

        <aside className="col-span-12 lg:col-span-4" aria-label="Resumen">
          <BookingSummary
            customerLabel={customer?.label ?? null}
            branchName={branchList.find((b) => b.id === branchId)?.name ?? null}
            service={service}
            employeeName={chosenEmployeeName}
            date={date}
            slot={slot}
            currency={currency}
            timeZone={timeZone}
            submitting={submitting}
            onCancel={() => navigate(agendaLink({ view: "week", date }))}
          />
        </aside>
      </div>
    </form>
  );
}
