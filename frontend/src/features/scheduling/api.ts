import { apiClient } from "@/api/client";
import { MAX_PAGE_SIZE, fetchAllPages, type AllPagesResult } from "@/lib/pagination";
import type { Paginated } from "@/types/api";
import type { Schedule } from "@/types/schedule";

export async function listSchedules(page: number): Promise<Paginated<Schedule>> {
  const response = await apiClient.get<Paginated<Schedule>>("/schedules/", {
    params: { page, page_size: MAX_PAGE_SIZE },
  });
  return response.data;
}

export async function listAllSchedules(): Promise<AllPagesResult<Schedule>> {
  return fetchAllPages(listSchedules);
}
