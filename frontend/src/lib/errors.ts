import axios from "axios";

import { ApiError } from "@/api/client";

/** Mensaje apto para mostrar al usuario: el del backend (ya en español) o uno genérico, nunca texto técnico. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

export function httpStatusOf(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  if (axios.isAxiosError(error)) return error.response?.status;
  return undefined;
}

/** 403: el usuario está autenticado pero no tiene permiso (distinto de un fallo de red o de «sin datos»). */
export function isForbidden(error: unknown): boolean {
  return httpStatusOf(error) === 403;
}

/** 409: el servidor rechazó la operación por un conflicto (p. ej. horario ocupado, transición inválida). */
export function isConflict(error: unknown): boolean {
  return httpStatusOf(error) === 409;
}
