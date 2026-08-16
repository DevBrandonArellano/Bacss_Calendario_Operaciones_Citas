import { apiClient } from "@/api/client";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export async function login(payload: LoginPayload): Promise<TokenPair> {
  const response = await apiClient.post<TokenPair>("/auth/login/", payload);
  return response.data;
}

export async function logout(refresh: string): Promise<void> {
  await apiClient.post("/auth/logout/", { refresh });
}
