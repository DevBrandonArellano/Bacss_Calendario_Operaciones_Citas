import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { createCustomer, getCustomer, updateCustomer } from "@/features/customers/api";
import type { CustomerInput } from "@/types/customer";

const EMPTY_FORM: Partial<CustomerInput> = {
  first_name: "",
  last_name: "",
  document_type: "",
  document_number: "",
  phone: "",
  email: "",
  address: "",
  birth_date: null,
  notes: "",
  status: "active",
};

export function CustomerFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<CustomerInput>>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && id) {
      getCustomer(id)
        .then((customer) => setForm(customer))
        .catch(() => setError("No se pudo cargar el cliente."))
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  function handleChange<K extends keyof CustomerInput>(field: K, value: CustomerInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        await createCustomer(form);
      } else if (id) {
        await updateCustomer(id, form);
      }
      navigate("/clientes");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo guardar el cliente.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{mode === "create" ? "Nuevo cliente" : "Editar cliente"}</h1>
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

        <label htmlFor="document_number">Documento</label>
        <input
          id="document_number"
          value={form.document_number ?? ""}
          onChange={(e) => handleChange("document_number", e.target.value)}
        />

        <label htmlFor="phone">Teléfono</label>
        <input id="phone" value={form.phone ?? ""} onChange={(e) => handleChange("phone", e.target.value)} />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.email ?? ""}
          onChange={(e) => handleChange("email", e.target.value)}
        />

        <label htmlFor="address">Dirección</label>
        <input
          id="address"
          value={form.address ?? ""}
          onChange={(e) => handleChange("address", e.target.value)}
        />

        <label htmlFor="birth_date">Fecha de nacimiento</label>
        <input
          id="birth_date"
          type="date"
          value={form.birth_date ?? ""}
          onChange={(e) => handleChange("birth_date", e.target.value || null)}
        />

        <label htmlFor="notes">Observaciones</label>
        <textarea id="notes" value={form.notes ?? ""} onChange={(e) => handleChange("notes", e.target.value)} />

        <label htmlFor="status">Estado</label>
        <select
          id="status"
          value={form.status ?? "active"}
          onChange={(e) => handleChange("status", e.target.value as CustomerInput["status"])}
        >
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>

        <div className="toolbar">
          <button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={() => navigate("/clientes")}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
