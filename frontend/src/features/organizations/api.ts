import { apiClient } from "@/api/client";
import type { Organization } from "@/types/organization";

export async function getMyOrganization(): Promise<Organization> {
  const response = await apiClient.get<Organization>("/organizations/me/");
  return response.data;
}
