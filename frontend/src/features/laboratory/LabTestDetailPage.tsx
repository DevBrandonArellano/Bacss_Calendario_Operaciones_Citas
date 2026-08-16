import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import {
  collectSample,
  getLabResult,
  getLabTest,
  recordLabResult,
  transitionLabTest,
  validateLabResult,
} from "@/features/laboratory/api";
import { LAB_PROCESS_STATUS_LABELS } from "@/types/laboratory";
import type { LabResult, LabTest } from "@/types/laboratory";

export function LabTestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [labTest, setLabTest] = useState<LabTest | null>(null);
  const [result, setResult] = useState<LabResult | null>(null);
  const [resultAccessError, setResultAccessError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const [sampleType, setSampleType] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [unit, setUnit] = useState("");
  const [referenceRange, setReferenceRange] = useState("");
  const [observations, setObservations] = useState("");

  async function loadLabTest(testId: string) {
    const data = await getLabTest(testId);
    setLabTest(data);

    if (data.result) {
      try {
        const resultData = await getLabResult(data.result.id);
        setResult(resultData);
        setResultAccessError(null);
      } catch (err) {
        setResult(null);
        setResultAccessError(
          err instanceof ApiError && err.status === 403
            ? "No tienes permiso para ver el valor clínico de este resultado."
            : "No se pudo cargar el resultado."
        );
      }
    } else {
      setResult(null);
      setResultAccessError(null);
    }
  }

  useEffect(() => {
    if (!id) return;
    loadLabTest(id)
      .catch(() => setError("No se pudo cargar la prueba."))
      .finally(() => setLoading(false));
  }, [id]);

  async function runAction(action: () => Promise<LabTest>) {
    if (!id) return;
    setActing(true);
    setError(null);
    try {
      await action();
      await loadLabTest(id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo completar la acción.";
      setError(message);
    } finally {
      setActing(false);
    }
  }

  async function handleCollectSample(event: FormEvent) {
    event.preventDefault();
    await runAction(() => collectSample(id!, { sample_type: sampleType }));
    setSampleType("");
  }

  async function handleRecordResult(event: FormEvent) {
    event.preventDefault();
    await runAction(() =>
      recordLabResult(id!, {
        result_value: resultValue,
        unit,
        reference_range: referenceRange,
        observations,
      })
    );
    setResultValue("");
    setUnit("");
    setReferenceRange("");
    setObservations("");
  }

  if (loading) return <p>Cargando...</p>;
  if (error && !labTest) return <p className="form-error">{error}</p>;
  if (!labTest) return null;

  return (
    <div>
      <Link to={`/laboratorio/pedidos/${labTest.lab_order}`}>&larr; Volver al pedido</Link>
      <div className="toolbar">
        <h1>
          {labTest.test_code} · {labTest.test_name}
        </h1>
        <span className={`badge badge-status-${labTest.status}`}>
          {LAB_PROCESS_STATUS_LABELS[labTest.status]}
        </span>
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {labTest.sample && (
        <p>
          Muestra: {labTest.sample.sample_type} · {labTest.sample.status}
        </p>
      )}

      {resultAccessError && (
        <p role="alert" className="form-error">
          {resultAccessError}
        </p>
      )}
      {result && (
        <div>
          <h2>Resultado</h2>
          <p>
            Valor: {result.result_value} {result.unit}
          </p>
          {result.reference_range && <p>Rango de referencia: {result.reference_range}</p>}
          {result.observations && <p>Observaciones: {result.observations}</p>}
          {result.validated_at && <p>Validado el {new Date(result.validated_at).toLocaleString("es-EC")}</p>}
        </div>
      )}

      {labTest.status === "ordered" && (
        <button type="button" disabled={acting} onClick={() => runAction(() => transitionLabTest(id!, "sample_pending"))}>
          Marcar esperando toma de muestra
        </button>
      )}

      {labTest.status === "sample_pending" && (
        <form onSubmit={handleCollectSample} className="auth-form">
          <h2>Registrar muestra</h2>
          <label htmlFor="sample-type">Tipo de muestra</label>
          <input id="sample-type" value={sampleType} onChange={(e) => setSampleType(e.target.value)} required />
          <button type="submit" disabled={acting}>
            {acting ? "Guardando..." : "Registrar muestra"}
          </button>
        </form>
      )}

      {labTest.status === "sample_taken" && (
        <button type="button" disabled={acting} onClick={() => runAction(() => transitionLabTest(id!, "processing"))}>
          Iniciar procesamiento
        </button>
      )}

      {labTest.status === "processing" && (
        <form onSubmit={handleRecordResult} className="auth-form">
          <h2>Registrar resultado</h2>
          <label htmlFor="result-value">Valor</label>
          <input id="result-value" value={resultValue} onChange={(e) => setResultValue(e.target.value)} required />

          <label htmlFor="result-unit">Unidad</label>
          <input id="result-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />

          <label htmlFor="result-range">Rango de referencia</label>
          <input id="result-range" value={referenceRange} onChange={(e) => setReferenceRange(e.target.value)} />

          <label htmlFor="result-observations">Observaciones</label>
          <textarea id="result-observations" value={observations} onChange={(e) => setObservations(e.target.value)} />

          <button type="submit" disabled={acting}>
            {acting ? "Guardando..." : "Registrar resultado"}
          </button>
        </form>
      )}

      {labTest.status === "result_available" && (
        <button type="button" disabled={acting} onClick={() => runAction(() => validateLabResult(id!))}>
          Validar resultado
        </button>
      )}

      {labTest.status === "validated" && (
        <button type="button" disabled={acting} onClick={() => runAction(() => transitionLabTest(id!, "delivered"))}>
          Marcar como entregado
        </button>
      )}

      {labTest.status === "delivered" && <p>Esta prueba llegó a su estado final.</p>}
    </div>
  );
}
