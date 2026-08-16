import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { createService, getService, updateService } from "@/features/services/api";
import type { ServiceInput } from "@/types/service";

const EMPTY_FORM: Partial<ServiceInput> = {
  name: "",
  category: "",
  duration_minutes: 30,
  price: "0.00",
  status: "active",
  branches: [],
};

export function ServiceFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<ServiceInput>>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && id) {
      getService(id)
        .then(setForm)
        .catch(() => setError("No se pudo cargar el servicio."))
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  function handleChange<K extends keyof ServiceInput>(field: K, value: ServiceInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        await createService(form);
      } else if (id) {
        await updateService(id, form);
      }
      navigate("/servicios");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo guardar el servicio.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{mode === "create" ? "Nuevo servicio" : "Editar servicio"}</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="name">Nombre</label>
        <input id="name" value={form.name ?? ""} onChange={(e) => handleChange("name", e.target.value)} required />

        <label htmlFor="category">Categoría</label>
        <input
          id="category"
          value={form.category ?? ""}
          onChange={(e) => handleChange("category", e.target.value)}
        />

        <label htmlFor="duration_minutes">Duración (minutos)</label>
        <input
          id="duration_minutes"
          type="number"
          min={1}
          value={form.duration_minutes ?? 30}
          onChange={(e) => handleChange("duration_minutes", Number(e.target.value))}
          required
        />

        <label htmlFor="price">Precio</label>
        <input
          id="price"
          type="number"
          min={0}
          step="0.01"
          value={form.price ?? "0.00"}
          onChange={(e) => handleChange("price", e.target.value)}
          required
        />

        <label htmlFor="status">Estado</label>
        <select
          id="status"
          value={form.status ?? "active"}
          onChange={(e) => handleChange("status", e.target.value as ServiceInput["status"])}
        >
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>

        <div className="toolbar">
          <button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={() => navigate("/servicios")}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
