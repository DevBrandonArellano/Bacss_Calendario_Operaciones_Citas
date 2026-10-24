import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/client";
import { errorMessage, isConflict, isForbidden } from "@/lib/errors";

const body = { code: "conflict", message: "Ese horario ya no está disponible.", details: {}, request_id: "r1" };

describe("errorMessage", () => {
  it("usa el mensaje del backend cuando es un ApiError", () => {
    expect(errorMessage(new ApiError(body, 409), "genérico")).toBe("Ese horario ya no está disponible.");
  });

  it("usa el genérico ante errores desconocidos, sin filtrar texto técnico", () => {
    expect(errorMessage(new Error("ECONNRESET stack..."), "No se pudo completar la acción.")).toBe("No se pudo completar la acción.");
    expect(errorMessage("algo", "x")).toBe("x");
  });
});

describe("isForbidden / isConflict", () => {
  it("reconoce 403 y 409 en ApiError", () => {
    expect(isForbidden(new ApiError(body, 403))).toBe(true);
    expect(isForbidden(new ApiError(body, 500))).toBe(false);
    expect(isConflict(new ApiError(body, 409))).toBe(true);
  });

  it("reconoce 403 en errores crudos de axios", () => {
    const error = new AxiosError("forbidden", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 403,
      statusText: "Forbidden",
      headers: {},
      config: {} as never,
      data: {},
    });
    expect(isForbidden(error)).toBe(true);
  });

  it("un error de red no es un 403", () => {
    expect(isForbidden(new Error("Network Error"))).toBe(false);
  });
});
