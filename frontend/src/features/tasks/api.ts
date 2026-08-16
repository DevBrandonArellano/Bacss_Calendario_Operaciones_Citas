import { apiClient } from "@/api/client";
import type { Paginated } from "@/types/api";
import type { Task, TaskOwnerType, TaskStatus } from "@/types/task";

export async function listTasks(
  ownerType?: TaskOwnerType,
  ownerId?: string
): Promise<Paginated<Task>> {
  const params = ownerType && ownerId ? { owner_type: ownerType, owner_id: ownerId } : {};
  const response = await apiClient.get<Paginated<Task>>("/tasks/", { params });
  return response.data;
}

export async function createTask(payload: {
  owner_type: TaskOwnerType;
  owner_id: string;
  title: string;
  description?: string;
  due_date?: string | null;
  priority?: string;
}): Promise<Task> {
  const response = await apiClient.post<Task>("/tasks/", payload);
  return response.data;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const response = await apiClient.patch<Task>(`/tasks/${id}/`, { status });
  return response.data;
}
