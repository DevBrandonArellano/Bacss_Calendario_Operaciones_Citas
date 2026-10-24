import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useTheme } from "@/hooks/useTheme";
import { installInMemoryLocalStorage } from "@/test-support/localStorageStub";

describe("useTheme", () => {
  beforeEach(() => {
    installInMemoryLocalStorage();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("por defecto usa 'system' y no fija data-theme (deja mandar a prefers-color-scheme)", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("al elegir 'dark' fija data-theme y lo persiste en localStorage", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme("dark"));

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme-preference")).toBe("dark");
  });

  it("al volver a 'system' quita el override manual", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setTheme("light"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => result.current.setTheme("system"));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("theme-preference")).toBe("system");
  });

  it("recupera la preferencia guardada al montar", () => {
    localStorage.setItem("theme-preference", "dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("ignora un valor corrupto en localStorage y cae a 'system'", () => {
    localStorage.setItem("theme-preference", "purple");

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe("system");
  });
});
