import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/ThemeToggle";
import { installInMemoryLocalStorage } from "@/test-support/localStorageStub";

describe("ThemeToggle", () => {
  beforeEach(() => {
    installInMemoryLocalStorage();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("muestra 'Sistema' seleccionado por defecto", () => {
    render(<ThemeToggle />);

    expect(screen.getByLabelText("Tema")).toHaveValue("system");
  });

  it("al elegir 'Oscuro' aplica el override manual persistido", () => {
    render(<ThemeToggle />);

    fireEvent.change(screen.getByLabelText("Tema"), { target: { value: "dark" } });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("theme-preference")).toBe("dark");
  });
});
