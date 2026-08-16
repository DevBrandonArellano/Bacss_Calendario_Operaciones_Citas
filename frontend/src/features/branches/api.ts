import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Branch } from "@/types/branch";

export interface ListBranchesParams {
  page?: number;
}

export async function listBranches(params: ListBranchesParams = {}): Promise<Paginated<Branch>> {
  const response = await apiClient.get<Paginated<Branch>>("/branches/", { params });
  return response.data;
}
