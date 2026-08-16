import { apiClient } from "@/api/client";
import type { SearchResult } from "@/types/search";

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const response = await apiClient.get<{ results: SearchResult[] }>("/search/", { params: { q: query } });
  return response.data.results;
}
