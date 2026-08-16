import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/features/auth/AuthContext";
import { LoginPage } from "@/features/auth/LoginPage";
import { BookAppointmentPage } from "@/features/appointments/BookAppointmentPage";
import { CalendarPage } from "@/features/appointments/CalendarPage";
import { CustomerFormPage } from "@/features/customers/CustomerFormPage";
import { CustomerHistoryPage } from "@/features/customers/CustomerHistoryPage";
import { CustomerListPage } from "@/features/customers/CustomerListPage";
import { EmployeeFormPage } from "@/features/employees/EmployeeFormPage";
import { EmployeeListPage } from "@/features/employees/EmployeeListPage";
import { CaseDetailPage } from "@/features/legal/CaseDetailPage";
import { CaseListPage } from "@/features/legal/CaseListPage";
import { LabOrderDetailPage } from "@/features/laboratory/LabOrderDetailPage";
import { LabOrderListPage } from "@/features/laboratory/LabOrderListPage";
import { LabTestDetailPage } from "@/features/laboratory/LabTestDetailPage";
import { PatientFormPage } from "@/features/laboratory/PatientFormPage";
import { PatientListPage } from "@/features/laboratory/PatientListPage";
import { MotorcycleFormPage } from "@/features/moto/MotorcycleFormPage";
import { MotorcycleHistoryPage } from "@/features/moto/MotorcycleHistoryPage";
import { MotorcycleListPage } from "@/features/moto/MotorcycleListPage";
import { WorkOrderDetailPage } from "@/features/moto/WorkOrderDetailPage";
import { WorkOrderListPage } from "@/features/moto/WorkOrderListPage";
import { NotificationsPage } from "@/features/notifications/NotificationsPage";
import { PaymentsPage } from "@/features/payments/PaymentsPage";
import { DashboardPage } from "@/features/reports/DashboardPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SearchPage } from "@/features/search/SearchPage";
import { ServiceFormPage } from "@/features/services/ServiceFormPage";
import { ServiceListPage } from "@/features/services/ServiceListPage";
import { OrderDetailPage } from "@/features/store/OrderDetailPage";
import { OrderListPage } from "@/features/store/OrderListPage";
import { ProductFormPage } from "@/features/store/ProductFormPage";
import { ProductListPage } from "@/features/store/ProductListPage";
import { ModuleRoute } from "@/routes/ModuleRoute";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/citas" replace />} />
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CustomerListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes/nuevo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CustomerFormPage mode="create" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes/:id/editar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CustomerFormPage mode="edit" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes/:id/historial"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CustomerHistoryPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servicios"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ServiceListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servicios/nuevo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ServiceFormPage mode="create" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servicios/:id/editar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ServiceFormPage mode="edit" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profesionales"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EmployeeListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profesionales/nuevo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EmployeeFormPage mode="create" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profesionales/:id/editar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EmployeeFormPage mode="edit" />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/citas"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CalendarPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/citas/nueva"
          element={
            <ProtectedRoute>
              <AppLayout>
                <BookAppointmentPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notificaciones"
          element={
            <ProtectedRoute>
              <AppLayout>
                <NotificationsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pagos"
          element={
            <ProtectedRoute>
              <AppLayout>
                <PaymentsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/motos"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="moto">
                  <MotorcycleListPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/motos/nueva"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="moto">
                  <MotorcycleFormPage mode="create" />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/motos/:id/editar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="moto">
                  <MotorcycleFormPage mode="edit" />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/motos/:id/historial"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="moto">
                  <MotorcycleHistoryPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordenes-trabajo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="moto">
                  <WorkOrderListPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordenes-trabajo/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="moto">
                  <WorkOrderDetailPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/laboratorio/pacientes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="laboratory">
                  <PatientListPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/laboratorio/pacientes/nuevo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="laboratory">
                  <PatientFormPage mode="create" />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/laboratorio/pacientes/:id/editar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="laboratory">
                  <PatientFormPage mode="edit" />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/laboratorio/pedidos"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="laboratory">
                  <LabOrderListPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/laboratorio/pedidos/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="laboratory">
                  <LabOrderDetailPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/laboratorio/pruebas/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="laboratory">
                  <LabTestDetailPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tienda/productos"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="store">
                  <ProductListPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tienda/productos/nuevo"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="store">
                  <ProductFormPage mode="create" />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tienda/productos/:id/editar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="store">
                  <ProductFormPage mode="edit" />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tienda/pedidos"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="store">
                  <OrderListPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tienda/pedidos/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="store">
                  <OrderDetailPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/legal/casos"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="legal">
                  <CaseListPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/legal/casos/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleRoute moduleCode="legal">
                  <CaseDetailPage />
                </ModuleRoute>
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/buscar"
          element={
            <ProtectedRoute>
              <AppLayout>
                <SearchPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reportes"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ReportsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
