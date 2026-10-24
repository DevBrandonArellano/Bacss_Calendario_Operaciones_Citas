import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ResourceView } from "@/components/ui/ResourceView";
import { AppointmentDrawer } from "@/features/appointments/agenda/AppointmentDrawer";
import { ActiveFilterChips, AgendaFilters } from "@/features/appointments/agenda/AgendaFilters";
import { AgendaHeader } from "@/features/appointments/agenda/AgendaHeader";
import { AgendaNotice, type Notice } from "@/features/appointments/agenda/AgendaNotice";
import {
  EmptyFiltered,
  EmptyPeriod,
  ForbiddenState,
  NoScheduleNotice,
  PickEmployee,
  TruncatedNotice,
} from "@/features/appointments/agenda/AgendaStates";
import { computeRange, rangeLabel, stepDate, type AgendaView } from "@/features/appointments/agenda/agendaRange";
import { agendaLink, hasActiveFilters } from "@/features/appointments/agenda/agendaUrl";
import type { AppointmentAction } from "@/features/appointments/agenda/appointmentActions";
import { DayView } from "@/features/appointments/agenda/DayView";
import { ListView } from "@/features/appointments/agenda/ListView";
import { MonthView } from "@/features/appointments/agenda/MonthView";
import { ProfessionalView } from "@/features/appointments/agenda/ProfessionalView";
import { schedulesForWindow } from "@/features/appointments/agenda/scheduleSegments";
import { computeVisibleHours, formatMinutes } from "@/features/appointments/agenda/timeGrid";
import { dataOrEmpty, needsEmployee, useAgendaAppointments, useAgendaCatalogs } from "@/features/appointments/agenda/useAgendaData";
import { useAgendaState } from "@/features/appointments/agenda/useAgendaState";
import { useAppointmentActions } from "@/features/appointments/agenda/useAppointmentActions";
import type { AgendaViewProps } from "@/features/appointments/agenda/viewTypes";
import { WeekView } from "@/features/appointments/agenda/WeekView";
import { CancelAppointmentDialog } from "@/features/appointments/CancelAppointmentDialog";
import { RescheduleDialog } from "@/features/appointments/RescheduleDialog";
import { useAuth } from "@/features/auth/useAuth";
import { useBusinessNow } from "@/hooks/useBusinessNow";
import { formatLongDate, parseISODate, toISODate } from "@/lib/dates";
import { isForbidden } from "@/lib/errors";
import type { Appointment } from "@/types/appointment";

const VIEW_COMPONENTS: Record<AgendaView, ComponentType<AgendaViewProps>> = {
  day: DayView,
  week: WeekView,
  month: MonthView,
  professional: ProfessionalView,
  list: ListView,
};

const SKELETON_HEIGHT = "h-[28rem]";

type DialogState = { type: "cancel" | "reschedule"; appointment: Appointment } | null;

/** Pantalla de Agenda: calendario por día, semana, mes, profesional y lista, con filtros, detalle y acciones. */
export function CalendarPage() {
  const { organization, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const now = useBusinessNow(organization?.timezone);
  const { state, update } = useAgendaState(now.date);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const requestedAppointment = useRef(state.appointment);

  const [appointments, reload] = useAgendaAppointments(state);
  const catalogs = useAgendaCatalogs();
  const employees = dataOrEmpty(catalogs.employees);
  const services = dataOrEmpty(catalogs.services);
  const schedules = catalogs.schedules.status === "ready" ? catalogs.schedules.data : null;

  const actions = useAppointmentActions(reload);
  const canCreate = can("appointments:write");
  const canWrite = canCreate;

  const list = useMemo(() => (appointments.status === "ready" ? appointments.data.results : []), [appointments]);
  const referenceDate = useMemo(() => parseISODate(state.date), [state.date]);
  const range = useMemo(() => computeRange(state.view, referenceDate), [state.view, referenceDate]);

  const visibleWindow = useMemo(
    () => computeVisibleHours(schedules ? schedulesForWindow(schedules, employees, state.employee) : [], list),
    [schedules, employees, state.employee, list]
  );

  const selected = list.find((a) => a.id === state.appointment);
  const refreshing = appointments.status === "ready" && appointments.refreshing;
  const filtered = hasActiveFilters(state);
  const label = rangeLabel(state.view, referenceDate);
  const isToday = toISODate(range.from) <= now.date && now.date <= toISODate(range.to);

  // La vista «Por profesional» arranca con el primer profesional para no mostrar una pantalla vacía.
  useEffect(() => {
    if (state.view === "professional" && !state.employee && employees.length > 0) {
      update({ employee: employees[0].id }, { replace: true });
    }
  }, [state.view, state.employee, employees, update]);

  // Aviso que llega al volver de «Nueva cita» (se limpia del historial para no repetirlo al recargar).
  useEffect(() => {
    const incoming = (location.state as { notice?: Notice } | null)?.notice;
    if (incoming) {
      setNotice(incoming);
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    }
  }, [location, navigate]);

  // Si la cita abierta ya no está en el resultado (enlace viejo, filtro, cambio de estado), se cierra el panel.
  useEffect(() => {
    if (!state.appointment || appointments.status !== "ready" || appointments.refreshing || selected) return;
    if (requestedAppointment.current === state.appointment) {
      setNotice({ tone: "info", text: "No se encontró la cita solicitada en este período." });
      requestedAppointment.current = "";
    }
    update({ appointment: "" }, { replace: true });
  }, [state.appointment, appointments, selected, update]);

  const newAppointmentHref = useMemo(() => {
    const params = new URLSearchParams({ date: state.date });
    if (state.employee) params.set("employee", state.employee);
    return `/citas/nueva?${params.toString()}`;
  }, [state.date, state.employee]);

  function goToNewAppointment(slot: { date: string; minutes: number; employeeId?: string }) {
    if (!canCreate) return;
    const params = new URLSearchParams({ date: slot.date, time: formatMinutes(slot.minutes) });
    if (slot.employeeId) params.set("employee", slot.employeeId);
    navigate(`/citas/nueva?${params.toString()}`);
  }

  const dismissNotice = useCallback(() => setNotice(null), []);

  async function handleAction(appointment: Appointment, action: AppointmentAction) {
    if (action === "cancel" || action === "reschedule") {
      actions.clearError();
      setDialog({ type: action, appointment });
      return;
    }
    const outcome = await actions.run(appointment, { type: action });
    if (outcome.ok && outcome.message) setNotice({ tone: "success", text: outcome.message });
  }

  async function handleCancel(appointment: Appointment, reason: string) {
    const outcome = await actions.run(appointment, { type: "cancel", reason });
    if (!outcome.ok) return;
    setDialog(null);
    setNotice({ tone: "success", text: outcome.message ?? "Cita cancelada." });
  }

  async function handleReschedule(appointment: Appointment, date: string, startTime: string) {
    const outcome = await actions.run(appointment, { type: "reschedule", date, startTime });
    if (!outcome.ok || !outcome.result) return;
    setDialog(null);
    update({ appointment: "" });
    setNotice({
      tone: "success",
      text: `Cita reprogramada para el ${formatLongDate(outcome.result.appointment_date)} a las ${outcome.result.start_time.slice(0, 5)}.`,
      link: {
        to: agendaLink({ view: "day", date: outcome.result.appointment_date, appointment: outcome.result.id }),
        label: "Ver la nueva cita",
      },
    });
  }

  async function handleSaveNotes(appointment: Appointment, notes: string) {
    const outcome = await actions.run(appointment, { type: "notes", notes });
    if (outcome.ok && outcome.message) setNotice({ tone: "success", text: outcome.message });
  }

  const View = VIEW_COMPONENTS[state.view];
  const isGrid = state.view !== "list";
  const clearFilters = () => update({ employee: "", service: "", statuses: [] });

  const viewProps: AgendaViewProps = {
    date: referenceDate,
    appointments: list,
    employees,
    schedules,
    window: visibleWindow,
    now,
    selectedId: state.appointment,
    employeeFilter: state.employee,
    onSelect: (appointment) => update({ appointment: appointment.id }),
    onSlotSelect: canCreate ? goToNewAppointment : undefined,
    onOpenDay: (iso) => update({ view: "day", date: iso, appointment: "" }),
  };

  return (
    <div>
      <AgendaHeader
        view={state.view}
        rangeLabel={label}
        canCreate={canCreate}
        newAppointmentHref={newAppointmentHref}
        filtersOpen={filtersOpen}
        activeFilterCount={(state.employee ? 1 : 0) + (state.service ? 1 : 0) + state.statuses.length}
        refreshing={refreshing || appointments.status === "loading"}
        isToday={isToday}
        onToday={() => update({ date: now.date, appointment: "" })}
        onStep={(direction) => update({ date: toISODate(stepDate(state.view, referenceDate, direction)), appointment: "" })}
        onViewChange={(view) => update({ view, appointment: "" })}
        onToggleFilters={() => setFiltersOpen((open) => !open)}
        onRefresh={reload}
      />

      {filtersOpen && (
        <AgendaFilters state={state} employees={employees} services={services} onChange={update} onClear={clearFilters} />
      )}
      <ActiveFilterChips state={state} employees={employees} services={services} onChange={update} />

      {notice && <AgendaNotice notice={notice} onDismiss={dismissNotice} />}
      {isGrid && schedules !== null && schedules.length === 0 && <NoScheduleNotice />}

      {needsEmployee(state) ? (
        <PickEmployee hasEmployees={employees.length > 0} />
      ) : appointments.status === "error" && isForbidden(appointments.error) ? (
        <ForbiddenState />
      ) : (
        <div aria-busy={appointments.status === "loading" || refreshing}>
          <ResourceView state={appointments} errorTitle="No se pudo cargar la agenda" onRetry={reload} skeletonClassName={SKELETON_HEIGHT}>
            {(result) => (
              <>
                {result.truncated && <TruncatedNotice shown={result.results.length} total={result.total} />}
                {result.results.length === 0 &&
                  (filtered ? (
                    <EmptyFiltered onClear={clearFilters} compact={isGrid} />
                  ) : (
                    <EmptyPeriod
                      rangeLabel={label}
                      canCreate={canCreate}
                      newAppointmentHref={newAppointmentHref}
                      showGoToToday={!isToday}
                      onToday={() => update({ date: now.date })}
                      compact={isGrid}
                    />
                  ))}
                {(isGrid || result.results.length > 0) && (
                  <div className={result.results.length === 0 ? "mt-4" : undefined}>
                    <View {...viewProps} />
                  </div>
                )}
              </>
            )}
          </ResourceView>
        </div>
      )}

      {selected && (
        <AppointmentDrawer
          appointment={selected}
          currency={organization?.currency ?? "USD"}
          canWrite={canWrite}
          canViewCustomer={can("customers:read")}
          canViewPrice={can("services:read")}
          busy={actions.busy}
          error={dialog ? null : actions.error}
          onAction={(action) => handleAction(selected, action)}
          onSaveNotes={(notes) => handleSaveNotes(selected, notes)}
          onClose={() => update({ appointment: "" })}
        />
      )}

      {dialog?.type === "cancel" && (
        <CancelAppointmentDialog
          appointment={dialog.appointment}
          busy={actions.busy}
          error={actions.error}
          onConfirm={(reason) => handleCancel(dialog.appointment, reason)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "reschedule" && (
        <RescheduleDialog
          appointment={dialog.appointment}
          today={now.date}
          busy={actions.busy}
          error={actions.error}
          onConfirm={(date, startTime) => handleReschedule(dialog.appointment, date, startTime)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
