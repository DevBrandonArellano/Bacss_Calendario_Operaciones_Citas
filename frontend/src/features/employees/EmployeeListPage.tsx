import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteEmployee, listEmployees } from "@/features/employees/api";
import type { Employee } from "@/types/service";

export function EmployeeListPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);

  async function fetchEmployees() {
    setLoading(true);
    setError(null);
    try {
      const data = await listEmployees({ page, ordering: "last_name" });
      setEmployees(data.results);
      setCount(data.count);
    } catch {
      setError("No se pudo cargar la lista de profesionales.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteEmployee(pendingDelete.id);
      setPendingDelete(null);
      await fetchEmployees();
    } catch {
      setError("No se pudo eliminar el profesional.");
      setPendingDelete(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="toolbar">
        <h1>Profesionales</h1>
        <Link to="/profesionales/nuevo">
          <button type="button">Nuevo profesional</button>
        </Link>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p>Cargando...</p>}
      {!loading && employees.length === 0 && <p>No se encontraron profesionales.</p>}

      {!loading && employees.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Especialidad</th>
              <th>Estado</th>
              <th>Servicios</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.full_name}</td>
                <td>{employee.specialty || "—"}</td>
                <td>{employee.is_active ? "Activo" : "Inactivo"}</td>
                <td>{employee.services.length}</td>
                <td>
                  <Link to={`/profesionales/${employee.id}/editar`}>Editar</Link>{" "}
                  <button type="button" onClick={() => setPendingDelete(employee)}>
                    Eliminar
                  </button>
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

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar profesional"
          message={`¿Seguro que deseas eliminar a ${pendingDelete.full_name}? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
