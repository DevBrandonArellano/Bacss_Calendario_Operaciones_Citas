import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import { formatLongDate } from "@/lib/dates";
import type { AvailabilitySlot } from "@/types/appointment";
import type { Service } from "@/types/service";

interface BookingSummaryProps {
  customerLabel: string | null;
  branchName: string | null;
  service: Service | null;
  employeeName: string | null;
  date: string;
  slot: AvailabilitySlot | null;
  currency: string;
  timeZone: string;
  submitting: boolean;
  onCancel: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="m-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

const PENDING = <span className="text-muted">Pendiente de elegir</span>;

/** Resumen vivo de lo elegido; el botón de guardar vive aquí para que esté siempre a la vista. */
export function BookingSummary({
  customerLabel,
  branchName,
  service,
  employeeName,
  date,
  slot,
  currency,
  timeZone,
  submitting,
  onCancel,
}: BookingSummaryProps) {
  return (
    <Card className="flex flex-col gap-5 lg:sticky lg:top-24">
      <h2 className="m-0 text-base font-semibold text-ink">Resumen de la cita</h2>
      <dl className="m-0 grid gap-4">
        <Row label="Cliente">{customerLabel ?? PENDING}</Row>
        <Row label="Sucursal">{branchName ?? PENDING}</Row>
        <Row label="Servicio">
          {service ? (
            <>
              {service.name}
              <br />
              <span className="text-muted">
                {service.duration_minutes} min · {formatCurrency(service.price, currency)}
              </span>
            </>
          ) : (
            PENDING
          )}
        </Row>
        <Row label="Profesional">{employeeName ?? (slot ? PENDING : <span className="text-muted">Según el horario elegido</span>)}</Row>
        <Row label="Fecha y hora">
          {slot ? (
            <>
              {formatLongDate(date)}
              <br />
              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
            </>
          ) : (
            PENDING
          )}
        </Row>
      </dl>
      <p className="m-0 text-xs text-muted">Horarios en la zona horaria del negocio ({timeZone}).</p>
      <div className="flex flex-col gap-2">
        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar cita"}
        </Button>
        <Button onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
