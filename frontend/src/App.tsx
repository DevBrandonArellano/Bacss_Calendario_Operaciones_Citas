import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

import { BookAppointmentPage } from "@/features/appointments/BookAppointmentPage";
import { CalendarPage } from "@/features/appointments/CalendarPage";
import { AuthProvider } from "@/features/auth/AuthContext";
import { LoginPage } from "@/features/auth/LoginPage";
import { CustomerFormPage } from "@/features/customers/CustomerFormPage";
import { CustomerHistoryPage } from "@/features/customers/CustomerHistoryPage";
import { CustomerListPage } from "@/features/customers/CustomerListPage";
import { EmployeeFormPage } from "@/features/employees/EmployeeFormPage";
import { EmployeeListPage } from "@/features/employees/EmployeeListPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { PaymentsPage } from "@/features/payments/PaymentsPage";
import { DashboardPage } from "@/features/reports/DashboardPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SearchPage } from "@/features/search/SearchPage";
import { ServiceFormPage } from "@/features/services/ServiceFormPage";
import { ServiceListPage } from "@/features/services/ServiceListPage";
import { ModuleLayout } from "@/routes/ModuleLayout";
import { ProtectedLayout } from "@/routes/ProtectedLayout";
import { publicRoutes } from "@/routes/publicRoutes";

// Las pantallas de módulo se cargan bajo demanda: una organización solo baja el
// código de los módulos que tiene activos (docs/module-system.md).
const MotorcycleListPage = lazy(() =>
  import("@/features/moto/MotorcycleListPage").then((m) => ({ default: m.MotorcycleListPage }))
);
const MotorcycleFormPage = lazy(() =>
  import("@/features/moto/MotorcycleFormPage").then((m) => ({ default: m.MotorcycleFormPage }))
);
const MotorcycleHistoryPage = lazy(() =>
  import("@/features/moto/MotorcycleHistoryPage").then((m) => ({ default: m.MotorcycleHistoryPage }))
);
const WorkOrderListPage = lazy(() =>
  import("@/features/moto/WorkOrderListPage").then((m) => ({ default: m.WorkOrderListPage }))
);
const WorkOrderDetailPage = lazy(() =>
  import("@/features/moto/WorkOrderDetailPage").then((m) => ({ default: m.WorkOrderDetailPage }))
);

const PatientListPage = lazy(() =>
  import("@/features/laboratory/PatientListPage").then((m) => ({ default: m.PatientListPage }))
);
const PatientFormPage = lazy(() =>
  import("@/features/laboratory/PatientFormPage").then((m) => ({ default: m.PatientFormPage }))
);
const LabOrderListPage = lazy(() =>
  import("@/features/laboratory/LabOrderListPage").then((m) => ({ default: m.LabOrderListPage }))
);
const LabOrderDetailPage = lazy(() =>
  import("@/features/laboratory/LabOrderDetailPage").then((m) => ({ default: m.LabOrderDetailPage }))
);
const LabTestDetailPage = lazy(() =>
  import("@/features/laboratory/LabTestDetailPage").then((m) => ({ default: m.LabTestDetailPage }))
);

const ProductListPage = lazy(() =>
  import("@/features/store/ProductListPage").then((m) => ({ default: m.ProductListPage }))
);
const ProductFormPage = lazy(() =>
  import("@/features/store/ProductFormPage").then((m) => ({ default: m.ProductFormPage }))
);
const OrderListPage = lazy(() =>
  import("@/features/store/OrderListPage").then((m) => ({ default: m.OrderListPage }))
);
const OrderDetailPage = lazy(() =>
  import("@/features/store/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage }))
);

const CaseListPage = lazy(() =>
  import("@/features/legal/CaseListPage").then((m) => ({ default: m.CaseListPage }))
);
const CaseDetailPage = lazy(() =>
  import("@/features/legal/CaseDetailPage").then((m) => ({ default: m.CaseDetailPage }))
);

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {publicRoutes}

        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/reportes" element={<ReportsPage />} />
          <Route path="/buscar" element={<SearchPage />} />

          <Route path="/clientes" element={<CustomerListPage />} />
          <Route path="/clientes/nuevo" element={<CustomerFormPage mode="create" />} />
          <Route path="/clientes/:id/editar" element={<CustomerFormPage mode="edit" />} />
          <Route path="/clientes/:id/historial" element={<CustomerHistoryPage />} />

          <Route path="/servicios" element={<ServiceListPage />} />
          <Route path="/servicios/nuevo" element={<ServiceFormPage mode="create" />} />
          <Route path="/servicios/:id/editar" element={<ServiceFormPage mode="edit" />} />

          <Route path="/profesionales" element={<EmployeeListPage />} />
          <Route path="/profesionales/nuevo" element={<EmployeeFormPage mode="create" />} />
          <Route path="/profesionales/:id/editar" element={<EmployeeFormPage mode="edit" />} />

          <Route path="/citas" element={<CalendarPage />} />
          <Route path="/citas/nueva" element={<BookAppointmentPage />} />

          <Route path="/notificaciones" element={<NotificationsPage />} />
          <Route path="/pagos" element={<PaymentsPage />} />

          <Route element={<ModuleLayout moduleCode="moto" />}>
            <Route path="/motos" element={<MotorcycleListPage />} />
            <Route path="/motos/nueva" element={<MotorcycleFormPage mode="create" />} />
            <Route path="/motos/:id/editar" element={<MotorcycleFormPage mode="edit" />} />
            <Route path="/motos/:id/historial" element={<MotorcycleHistoryPage />} />
            <Route path="/ordenes-trabajo" element={<WorkOrderListPage />} />
            <Route path="/ordenes-trabajo/:id" element={<WorkOrderDetailPage />} />
          </Route>

          <Route element={<ModuleLayout moduleCode="laboratory" />}>
            <Route path="/laboratorio/pacientes" element={<PatientListPage />} />
            <Route path="/laboratorio/pacientes/nuevo" element={<PatientFormPage mode="create" />} />
            <Route path="/laboratorio/pacientes/:id/editar" element={<PatientFormPage mode="edit" />} />
            <Route path="/laboratorio/pedidos" element={<LabOrderListPage />} />
            <Route path="/laboratorio/pedidos/:id" element={<LabOrderDetailPage />} />
            <Route path="/laboratorio/pruebas/:id" element={<LabTestDetailPage />} />
          </Route>

          <Route element={<ModuleLayout moduleCode="store" />}>
            <Route path="/tienda/productos" element={<ProductListPage />} />
            <Route path="/tienda/productos/nuevo" element={<ProductFormPage mode="create" />} />
            <Route path="/tienda/productos/:id/editar" element={<ProductFormPage mode="edit" />} />
            <Route path="/tienda/pedidos" element={<OrderListPage />} />
            <Route path="/tienda/pedidos/:id" element={<OrderDetailPage />} />
          </Route>

          <Route element={<ModuleLayout moduleCode="legal" />}>
            <Route path="/legal/casos" element={<CaseListPage />} />
            <Route path="/legal/casos/:id" element={<CaseDetailPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
