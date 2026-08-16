import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { listCustomers } from "@/features/customers/api";
import { createPatient, getPatient, updatePatient } from "@/features/laboratory/api";
import type { Customer } from "@/types/customer";
import { PATIENT_SEX_LABELS } from "@/types/laboratory";
import type { PatientInput, PatientSex } from "@/types/laboratory";

const SEX_OPTIONS: PatientSex[] = ["female", "male", "other"];

const EMPTY_FORM: Partial<PatientInput> = {
  customer: null,
  first_name: "",
  last_name: "",
  document_number: "",
  birth_date: null,
  sex: "",
  medical_notes: "",
};

export function PatientFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<PatientInput>>(EMPTY_FORM);
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
      getPatient(id)
        .then(setForm)
        .catch(() => setError("No se pudo cargar el paciente."))
        .finally(() => setLoading(false));
    }
  }, [mode, id]);

  function handleChange<K extends keyof PatientInput>(field: K, value: PatientInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        await createPatient(form);
      } else if (id) {
        await updatePatient(id, form);
      }
      navigate("/laboratorio/pacientes");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo guardar el paciente.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>{mode === "create" ? "Nuevo paciente" : "Editar paciente"}</h1>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="first-name">Nombre</label>
        <input
          id="first-name"
          value={form.first_name ?? ""}
          onChange={(e) => handleChange("first_name", e.target.value)}
          required
        />

        <label htmlFor="last-name">Apellido</label>
        <input
          id="last-name"
          value={form.last_name ?? ""}
          onChange={(e) => handleChange("last_name", e.target.value)}
          required
        />

        <label htmlFor="document-number">Documento</label>
        <input
          id="document-number"
          value={form.document_number ?? ""}
          onChange={(e) => handleChange("document_number", e.target.value)}
        />

        <label htmlFor="birth-date">Fecha de nacimiento</label>
        <input
          id="birth-date"
          type="date"
          value={form.birth_date ?? ""}
          onChange={(e) => handleChange("birth_date", e.target.value || null)}
        />

        <label htmlFor="sex">Sexo</label>
        <select id="sex" value={form.sex ?? ""} onChange={(e) => handleChange("sex", e.target.value as PatientSex)}>
          <option value="">Sin especificar</option>
          {SEX_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {PATIENT_SEX_LABELS[option]}
            </option>
          ))}
        </select>

        <label htmlFor="customer">Cliente asociado (opcional)</label>
        <select
          id="customer"
          value={form.customer ?? ""}
          onChange={(e) => handleChange("customer", e.target.value || null)}
        >
          <option value="">Sin cliente asociado</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name}
            </option>
          ))}
        </select>

        <label htmlFor="medical-notes">Notas médicas</label>
        <textarea
          id="medical-notes"
          value={form.medical_notes ?? ""}
          onChange={(e) => handleChange("medical_notes", e.target.value)}
        />

        <div className="toolbar">
          <button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={() => navigate("/laboratorio/pacientes")}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
