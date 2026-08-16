import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { listCustomers } from "@/features/customers/api";
import { createMotorcycle, getMotorcycle, updateMotorcycle } from "@/features/moto/api";
import type { Customer } from "@/types/customer";
import type { MotorcycleInput } from "@/types/moto";

const EMPTY_FORM: Partial<MotorcycleInput> = {
  customer: "",
  plate: "",
  brand: "",
  model: "",
  year: null,
  color: "",
  vin: "",
  engine_number: "",
  mileage: 0,
  notes: "",
};

export function MotorcycleFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<MotorcycleInput>>(EMPTY_FORM);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomers({ page: 1, ordering: "last_name" })
      .then((data) => setCustomers(data.results))
      .catch(() => setError("No se pudo cargar la lista de clientes."));
  }, []);

  useEffect(() => {
    if (mode === "edit" && id) {
      getMotorcycle(id)
        .then(setForm)
        .catch(() => setError("No se pudo cargar la moto."))
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  function handleChange<K extends keyof MotorcycleInput>(field: K, value: MotorcycleInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        await createMotorcycle(form);
      } else if (id) {
        await updateMotorcycle(id, form);
      }
      navigate("/motos");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo guardar la moto.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{mode === "create" ? "Nueva moto" : "Editar moto"}</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="customer">Cliente</label>
        <select
          id="customer"
          value={form.customer ?? ""}
          onChange={(e) => handleChange("customer", e.target.value)}
          required
        >
          <option value="" disabled>
            Selecciona un cliente
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name}
            </option>
          ))}
        </select>

        <label htmlFor="plate">Placa</label>
        <input
          id="plate"
          value={form.plate ?? ""}
          onChange={(e) => handleChange("plate", e.target.value)}
          required
        />

        <label htmlFor="brand">Marca</label>
        <input
          id="brand"
          value={form.brand ?? ""}
          onChange={(e) => handleChange("brand", e.target.value)}
          required
        />

        <label htmlFor="model">Modelo</label>
        <input
          id="model"
          value={form.model ?? ""}
          onChange={(e) => handleChange("model", e.target.value)}
          required
        />

        <label htmlFor="year">Año</label>
        <input
          id="year"
          type="number"
          value={form.year ?? ""}
          onChange={(e) => handleChange("year", e.target.value ? Number(e.target.value) : null)}
        />

        <label htmlFor="mileage">Kilometraje</label>
        <input
          id="mileage"
          type="number"
          min="0"
          value={form.mileage ?? 0}
          onChange={(e) => handleChange("mileage", Number(e.target.value))}
        />

        <label htmlFor="notes">Notas</label>
        <textarea id="notes" value={form.notes ?? ""} onChange={(e) => handleChange("notes", e.target.value)} />

        <div className="toolbar">
          <button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={() => navigate("/motos")}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
