import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Document as DocumentRecord, DocumentOwnerType } from "@/types/document";

export async function listDocuments(
  ownerType: DocumentOwnerType,
  ownerId: string
): Promise<Paginated<DocumentRecord>> {
  const response = await apiClient.get<Paginated<DocumentRecord>>("/documents/", {
    params: { owner_type: ownerType, owner_id: ownerId },
  });
  return response.data;
}

export async function uploadDocument(
  ownerType: DocumentOwnerType,
  ownerId: string,
  name: string,
  file: File
): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append("owner_type", ownerType);
  formData.append("owner_id", ownerId);
  formData.append("name", name);
  formData.append("file", file);

  const response = await apiClient.post<DocumentRecord>("/documents/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function downloadDocument(id: string, filename: string): Promise<void> {
  const response = await apiClient.get(`/documents/${id}/download/`, { responseType: "blob" });
  const url = window.URL.createObjectURL(response.data as Blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
