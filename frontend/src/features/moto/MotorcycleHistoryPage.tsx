import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { addMotorcycleHistory, getMotorcycle, listMotorcycleHistory } from "@/features/moto/api";
import type { Motorcycle, VehicleHistoryEntry } from "@/types/moto";

const EMPTY_FORM = { service_date: "", mileage: "", service_description: "", diagnosis: "", cost: "" };

export function MotorcycleHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [entries, setEntries] = useState<VehicleHistoryEntry[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadEntries(motorcycleId: string) {
    const data = await listMotorcycleHistory(motorcycleId);
    setEntries(data.results);
  }

  useEffect(() => {
    if (!id) return;
    Promise.all([getMotorcycle(id), listMotorcycleHistory(id)])
      .then(([motorcycleData, historyData]) => {
        setMotorcycle(motorcycleData);
        setEntries(historyData.results);
      })
      .catch(() => setError("No se pudo cargar el historial de la moto."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await addMotorcycleHistory(id, {
        service_date: form.service_date,
        mileage: Number(form.mileage),
        service_description: form.service_description,
        diagnosis: form.diagnosis,
        cost: form.cost || "0",
      });
      setForm(EMPTY_FORM);
      await loadEntries(id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo registrar el historial.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (!motorcycle) return <p className="form-error">No se encontró la moto.</p>;

  return (
    <div>
      <Link to="/motos">&larr; Volver a motos</Link>
      <h1>
        Historial de {motorcycle.plate} — {motorcycle.brand} {motorcycle.model}
      </h1>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <h2>Nueva entrada</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="service_date">Fecha de servicio</label>
        <input
          id="service_date"
          type="date"
          value={form.service_date}
          onChange={(e) => setForm((prev) => ({ ...prev, service_date: e.target.value }))}
          required
        />

        <label htmlFor="mileage">Kilometraje</label>
        <input
          id="mileage"
          type="number"
          min="0"
          value={form.mileage}
          onChange={(e) => setForm((prev) => ({ ...prev, mileage: e.target.value }))}
          required
        />

        <label htmlFor="service_description">Descripción del servicio</label>
        <input
          id="service_description"
          value={form.service_description}
          onChange={(e) => setForm((prev) => ({ ...prev, service_description: e.target.value }))}
          required
        />

        <label htmlFor="diagnosis">Diagnóstico</label>
        <textarea
          id="diagnosis"
          value={form.diagnosis}
          onChange={(e) => setForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
        />

        <label htmlFor="cost">Costo</label>
        <input
          id="cost"
          type="number"
          min="0"
          step="0.01"
          value={form.cost}
          onChange={(e) => setForm((prev) => ({ ...prev, cost: e.target.value }))}
        />

        <button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Agregar al historial"}
        </button>
      </form>

      <h2>Entradas registradas</h2>
      {entries.length === 0 ? (
        <p>Sin entradas de historial todavía.</p>
      ) : (
        <ul className="notification-list">
          {entries.map((entry) => (
            <li key={entry.id} className="notification-item">
              <div className="notification-item-header">
                <span className="notification-item-event">{entry.service_description}</span>
                <span className="badge">{entry.service_date}</span>
              </div>
              <p className="notification-item-body">
                {entry.mileage} km · {entry.diagnosis || "Sin diagnóstico registrado"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
