import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { createEmployee, getEmployee, setEmployeeServices, updateEmployee } from "@/features/employees/api";
import { listServices } from "@/features/services/api";
import type { EmployeeInput, Service } from "@/types/service";

const EMPTY_FORM: Partial<EmployeeInput> = {
  first_name: "",
  last_name: "",
  specialty: "",
  is_active: true,
  services: [],
};

export function EmployeeFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<EmployeeInput>>(EMPTY_FORM);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listServices({ page: 1, ordering: "name" })
      .then((data) => setAvailableServices(data.results))
      .catch(() => setError("No se pudo cargar el catálogo de servicios."));
  }, []);

  useEffect(() => {
    if (mode === "edit" && id) {
      getEmployee(id)
        .then((employee) => {
          setForm(employee);
          setSelectedServiceIds(employee.services);
        })
        .catch(() => setError("No se pudo cargar el profesional."))
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  function handleChange<K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleService(serviceId: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let employeeId = id;
      if (mode === "create") {
        const created = await createEmployee(form);
        employeeId = created.id;
      } else if (id) {
        await updateEmployee(id, form);
      }
      if (employeeId) {
        await setEmployeeServices(employeeId, selectedServiceIds);
      }
      navigate("/profesionales");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo guardar el profesional.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{mode === "create" ? "Nuevo profesional" : "Editar profesional"}</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="first_name">Nombre</label>
        <input
          id="first_name"
          value={form.first_name ?? ""}
          onChange={(e) => handleChange("first_name", e.target.value)}
          required
        />

        <label htmlFor="last_name">Apellido</label>
        <input
          id="last_name"
          value={form.last_name ?? ""}
          onChange={(e) => handleChange("last_name", e.target.value)}
          required
        />

        <label htmlFor="specialty">Especialidad</label>
        <input
          id="specialty"
          value={form.specialty ?? ""}
          onChange={(e) => handleChange("specialty", e.target.value)}
        />

        <label htmlFor="is_active">
          <input
            id="is_active"
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={(e) => handleChange("is_active", e.target.checked)}
          />{" "}
          Activo
        </label>

        <fieldset>
          <legend>Servicios que puede prestar</legend>
          {availableServices.map((service) => (
            <label key={service.id} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={selectedServiceIds.includes(service.id)}
                onChange={() => toggleService(service.id)}
              />{" "}
              {service.name}
            </label>
          ))}
          {availableServices.length === 0 && <p>No hay servicios registrados todavía.</p>}
        </fieldset>

        <div className="toolbar">
          <button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={() => navigate("/profesionales")}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
