import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  LabOrder,
  LabProcessStatus,
  LabResult,
  LabTest,
  LabTestSpec,
  Patient,
  PatientInput,
  Sample,
} from "@/types/laboratory";

export async function listPatients(
  params: { page?: number; document_number?: string } = {}
): Promise<Paginated<Patient>> {
  const response = await apiClient.get<Paginated<Patient>>("/modules/laboratory/patients/", { params });
  return response.data;
}

export async function getPatient(id: string): Promise<Patient> {
  const response = await apiClient.get<Patient>(`/modules/laboratory/patients/${id}/`);
  return response.data;
}

export async function createPatient(payload: Partial<PatientInput>): Promise<Patient> {
  const response = await apiClient.post<Patient>("/modules/laboratory/patients/", payload);
  return response.data;
}

export async function updatePatient(id: string, payload: Partial<PatientInput>): Promise<Patient> {
  const response = await apiClient.patch<Patient>(`/modules/laboratory/patients/${id}/`, payload);
  return response.data;
}

export async function listLabOrders(
  params: { page?: number; status?: string; patient?: string } = {}
): Promise<Paginated<LabOrder>> {
  const response = await apiClient.get<Paginated<LabOrder>>("/modules/laboratory/lab-orders/", { params });
  return response.data;
}

export async function getLabOrder(id: string): Promise<LabOrder> {
  const response = await apiClient.get<LabOrder>(`/modules/laboratory/lab-orders/${id}/`);
  return response.data;
}

export async function createLabOrder(payload: {
  patient_id: string;
  ordering_employee_id: string;
  tests: LabTestSpec[];
}): Promise<LabOrder> {
  const response = await apiClient.post<LabOrder>("/modules/laboratory/lab-orders/", payload);
  return response.data;
}

export async function getLabTest(id: string): Promise<LabTest> {
  const response = await apiClient.get<LabTest>(`/modules/laboratory/lab-tests/${id}/`);
  return response.data;
}

export async function transitionLabTest(id: string, status: LabProcessStatus): Promise<LabTest> {
  const response = await apiClient.post<LabTest>(`/modules/laboratory/lab-tests/${id}/transition/`, {
    status,
  });
  return response.data;
}

export async function collectSample(
  id: string,
  payload: { sample_type: string; collected_by_employee_id?: string | null }
): Promise<LabTest> {
  const response = await apiClient.post<LabTest>(
    `/modules/laboratory/lab-tests/${id}/collect-sample/`,
    payload
  );
  return response.data;
}

export async function recordLabResult(
  id: string,
  payload: { result_value: string; unit?: string; reference_range?: string; observations?: string }
): Promise<LabTest> {
  const response = await apiClient.post<LabTest>(
    `/modules/laboratory/lab-tests/${id}/record-result/`,
    payload
  );
  return response.data;
}

export async function validateLabResult(id: string): Promise<LabTest> {
  const response = await apiClient.post<LabTest>(`/modules/laboratory/lab-tests/${id}/validate/`, {});
  return response.data;
}

export async function getSample(id: string): Promise<Sample> {
  const response = await apiClient.get<Sample>(`/modules/laboratory/samples/${id}/`);
  return response.data;
}

export async function getLabResult(id: string): Promise<LabResult> {
  const response = await apiClient.get<LabResult>(`/modules/laboratory/lab-results/${id}/`);
  return response.data;
}
