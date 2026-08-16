import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { tokenStorage } from "@/lib/tokenStorage";
import type { ApiErrorBody } from "@/types/api";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

export const apiClient = axios.create({ baseURL });

export class ApiError extends Error {
  code: string;
  details: Record<string, unknown>;
  requestId: string;
  status?: number;

  constructor(body: ApiErrorBody, status?: number) {
    super(body.message);
    this.code = body.code;
    this.details = body.details;
    this.requestId = body.request_id;
    this.status = status;
  }
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = tokenStorage.getAccess();
  if (access) {
    config.headers.set("Authorization", `Bearer ${access}`);
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) throw new Error("No hay refresh token disponible.");

  const response = await axios.post<{ access: string }>(`${baseURL}/auth/token/refresh/`, { refresh });
  tokenStorage.setAccess(response.data.access);
  return response.data.access;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    const isAuthEndpoint = originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/token/refresh");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshAccessToken();
        const newAccess = await refreshPromise;
        refreshPromise = null;
        originalRequest.headers.set("Authorization", `Bearer ${newAccess}`);
        return apiClient(originalRequest);
      } catch {
        refreshPromise = null;
        tokenStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    if (error.response?.data && typeof error.response.data === "object" && "code" in error.response.data) {
      return Promise.reject(new ApiError(error.response.data, error.response.status));
    }
    return Promise.reject(error);
  }
);
