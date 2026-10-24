import { apiClient } from "@/api/client";
import type { UserProfile } from "@/types/user";

export async function getMyProfile(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>("/users/me/");
  return response.data;
}
