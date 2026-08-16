import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { CaseEvent, CaseTask, Hearing, LegalCase, LegalCaseStatus } from "@/types/legal";

export async function listLegalCases(
  params: { page?: number; status?: string } = {}
): Promise<Paginated<LegalCase>> {
  const response = await apiClient.get<Paginated<LegalCase>>("/modules/legal/cases/", { params });
  return response.data;
}

export async function getLegalCase(id: string): Promise<LegalCase> {
  const response = await apiClient.get<LegalCase>(`/modules/legal/cases/${id}/`);
  return response.data;
}

export async function createLegalCase(payload: {
  case_number: string;
  customer_id: string;
  case_type: string;
  responsible_lawyer_id: string;
  priority: string;
  description?: string;
}): Promise<LegalCase> {
  const response = await apiClient.post<LegalCase>("/modules/legal/cases/", payload);
  return response.data;
}

export async function transitionLegalCase(id: string, status: LegalCaseStatus): Promise<LegalCase> {
  const response = await apiClient.post<LegalCase>(`/modules/legal/cases/${id}/transition/`, { status });
  return response.data;
}

export async function listCaseEvents(caseId: string): Promise<Paginated<CaseEvent>> {
  const response = await apiClient.get<Paginated<CaseEvent>>(`/modules/legal/cases/${caseId}/events/`);
  return response.data;
}

export async function addCaseEvent(
  caseId: string,
  payload: { event_type: string; description?: string }
): Promise<CaseEvent> {
  const response = await apiClient.post<CaseEvent>(`/modules/legal/cases/${caseId}/events/`, payload);
  return response.data;
}

export async function listHearings(caseId: string): Promise<Paginated<Hearing>> {
  const response = await apiClient.get<Paginated<Hearing>>("/modules/legal/hearings/", {
    params: { legal_case: caseId },
  });
  return response.data;
}

export async function createHearing(payload: {
  legal_case: string;
  scheduled_at: string;
  location?: string;
  notes?: string;
}): Promise<Hearing> {
  const response = await apiClient.post<Hearing>("/modules/legal/hearings/", payload);
  return response.data;
}

export async function updateHearing(id: string, payload: Partial<Hearing>): Promise<Hearing> {
  const response = await apiClient.patch<Hearing>(`/modules/legal/hearings/${id}/`, payload);
  return response.data;
}

export async function listCaseTasks(caseId: string): Promise<Paginated<CaseTask>> {
  const response = await apiClient.get<Paginated<CaseTask>>("/modules/legal/case-tasks/", {
    params: { legal_case: caseId },
  });
  return response.data;
}

export async function createCaseTask(payload: {
  legal_case: string;
  title: string;
  description?: string;
  due_date?: string | null;
  priority?: string;
}): Promise<CaseTask> {
  const response = await apiClient.post<CaseTask>("/modules/legal/case-tasks/", payload);
  return response.data;
}

export async function updateCaseTask(id: string, payload: Partial<CaseTask>): Promise<CaseTask> {
  const response = await apiClient.patch<CaseTask>(`/modules/legal/case-tasks/${id}/`, payload);
  return response.data;
}
