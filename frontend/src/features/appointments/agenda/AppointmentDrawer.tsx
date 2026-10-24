import { Link } from "react-router-dom";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { AppointmentStatusBadge } from "@/features/appointments/AppointmentStatusBadge";
import {
  ACTION_LABELS,
  availableActions,
  canEditNotes,
  type AppointmentAction,
} from "@/features/appointments/agenda/appointmentActions";
import { formatCurrency } from "@/lib/format";
import { formatLongDate } from "@/lib/dates";
import { BOOKING_CHANNEL_LABELS, PAYMENT_STATUS_LABELS, type Appointment } from "@/types/appointment";

interface AppointmentDrawerProps {
  appointment: Appointment;
  currency: string;
  canWrite: boolean;
  canViewCustomer: boolean;
  canViewPrice: boolean;
  busy: boolean;
  error: string | null;
  onAction: (action: AppointmentAction) => void;
  onSaveNotes: (notes: string) => void;
  onClose: () => void;
}

const ACTION_VARIANT: Record<AppointmentAction, "primary" | "secondary" | "danger"> = {
  confirm: "primary",
  start: "primary",
  complete: "primary",
  reschedule: "secondary",
  no_show: "secondary",
  cancel: "danger",
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="m-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Panel lateral con el detalle de una cita y las acciones que su estado y los permisos del usuario permiten. */
export function AppointmentDrawer({
  appointment,
  currency,
  canWrite,
  canViewCustomer,
  canViewPrice,
  busy,
  error,
  onAction,
  onSaveNotes,
  onClose,
}: AppointmentDrawerProps) {
  const [draft, setDraft] = useState(appointment.notes);
  const editable = canWrite && canEditNotes(appointment.status);
  const actions = canWrite ? availableActions(appointment.status) : [];
  const notesChanged = draft.trim() !== appointment.notes.trim();

  return (
    <Drawer
      title="Detalle de la cita"
      onClose={onClose}
      footer={
        actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button key={action} variant={ACTION_VARIANT[action]} size="sm" disabled={busy} onClick={() => onAction(action)}>
                {ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentStatusBadge status={appointment.status} />
          <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold text-muted">
            {PAYMENT_STATUS_LABELS[appointment.payment_status] ?? appointment.payment_status}
          </span>
        </div>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <dl className="m-0 grid gap-4">
          <Detail label="Cliente">
            <span className="font-semibold">{appointment.customer_name}</span>
            {canViewCustomer && (
              <>
                {" · "}
                <Link to={`/clientes/${appointment.customer}/historial`} className="underline underline-offset-2">
                  Ver ficha
                </Link>
              </>
            )}
          </Detail>
          <Detail label="Servicio">
            {appointment.service_name} · {appointment.duration_minutes} min
            {canViewPrice && ` · ${formatCurrency(appointment.price, currency)}`}
          </Detail>
          <Detail label="Profesional">{appointment.employee_name}</Detail>
          <Detail label="Sucursal">{appointment.branch_name}</Detail>
          <Detail label="Fecha y hora">
            {formatLongDate(appointment.appointment_date)}
            <br />
            {appointment.start_time.slice(0, 5)} – {appointment.end_time.slice(0, 5)}
          </Detail>
          <Detail label="Origen">{BOOKING_CHANNEL_LABELS[appointment.booking_channel] ?? appointment.booking_channel}</Detail>
        </dl>

        <section aria-labelledby="notas-cita" className="flex flex-col gap-2">
          <h3 id="notas-cita" className="m-0 text-xs font-medium uppercase tracking-wide text-muted">
            Notas internas
          </h3>
          {editable ? (
            <>
              <label htmlFor="notas-cita-texto" className="sr-only">
                Notas internas de la cita
              </label>
              <textarea
                id="notas-cita-texto"
                rows={4}
                maxLength={2000}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div>
                <Button size="sm" disabled={busy || !notesChanged} onClick={() => onSaveNotes(draft.trim())}>
                  Guardar notas
                </Button>
              </div>
            </>
          ) : (
            <p className="m-0 whitespace-pre-wrap text-sm text-ink">{appointment.notes || "Sin notas."}</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
