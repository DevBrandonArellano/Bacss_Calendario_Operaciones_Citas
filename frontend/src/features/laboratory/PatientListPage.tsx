import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listPatients } from "@/features/laboratory/api";
import type { Patient } from "@/types/laboratory";

export function PatientListPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listPatients({ page })
      .then((data) => {
        setPatients(data.results);
        setCount(data.count);
      })
      .catch(() => setError("No se pudo cargar la lista de pacientes."))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <div>
      <div className="toolbar">
        <h1>Pacientes</h1>
        <Link to="/laboratorio/pacientes/nuevo">
          <button type="button">Nuevo paciente</button>
        </Link>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p>Cargando...</p>}
      {!loading && patients.length === 0 && <p>No hay pacientes registrados todavía.</p>}

      {!loading && patients.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Fecha de nacimiento</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td>
                  {patient.first_name} {patient.last_name}
                </td>
                <td>{patient.document_number || "—"}</td>
                <td>{patient.birth_date ?? "—"}</td>
                <td>
                  <Link to={`/laboratorio/pacientes/${patient.id}/editar`}>Editar</Link>
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
    </div>
  );
}
