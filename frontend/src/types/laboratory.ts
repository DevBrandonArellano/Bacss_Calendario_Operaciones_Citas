export type PatientSex = "female" | "male" | "other";

export const PATIENT_SEX_LABELS: Record<PatientSex, string> = {
  female: "Femenino",
  male: "Masculino",
  other: "Otro",
};

export interface Patient {
  id: string;
  customer: string | null;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  sex: PatientSex | "";
  medical_notes: string;
}

export type PatientInput = Omit<Patient, "id">;

export type LabProcessStatus =
  | "ordered"
  | "sample_pending"
  | "sample_taken"
  | "processing"
  | "result_available"
  | "validated"
  | "delivered";

export const LAB_PROCESS_STATUS_LABELS: Record<LabProcessStatus, string> = {
  ordered: "Solicitada",
  sample_pending: "Esperando toma de muestra",
  sample_taken: "Muestra tomada",
  processing: "En procesamiento",
  result_available: "Resultado disponible",
  validated: "Validado",
  delivered: "Entregado",
};

export type SampleStatus = "pending" | "collected" | "rejected";

export interface Sample {
  id: string;
  sample_type: string;
  collected_at: string | null;
  collected_by_employee: string | null;
  status: SampleStatus;
}

export interface LabResult {
  id: string;
  lab_test: string;
  result_value: string;
  unit: string;
  reference_range: string;
  observations: string;
  validated_by_employee: string | null;
  validated_at: string | null;
}

export interface LabTest {
  id: string;
  lab_order: string;
  test_code: string;
  test_name: string;
  status: LabProcessStatus;
  sample: Sample | null;
  // Solo una referencia: los valores clínicos exigen el permiso granular
  // `lab_results:read` y se piden aparte vía `getLabResult` (auditado).
  result: { id: string } | null;
}

export interface LabOrder {
  id: string;
  patient: string;
  ordering_employee: string;
  status: LabProcessStatus;
  ordered_at: string;
  tests: LabTest[];
}

export interface LabTestSpec {
  test_code: string;
  test_name: string;
}
