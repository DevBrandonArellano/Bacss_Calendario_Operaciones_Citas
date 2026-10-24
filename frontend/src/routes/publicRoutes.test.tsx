import { render } from "@testing-library/react";
import { MemoryRouter, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { publicRoutes } from "@/routes/publicRoutes";
import { PUBLIC_PAGES } from "@/seo/pages";

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{publicRoutes}</Routes>
    </MemoryRouter>
  );
}

describe.each(PUBLIC_PAGES)("página pública $path", (page) => {
  it("tiene un único H1 con el texto definido en la configuración SEO", () => {
    const { container } = renderPage(page.path);
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(page.h1);
  });

  it("la jerarquía de encabezados no salta niveles", () => {
    const { container } = renderPage(page.path);
    const levels = [...container.querySelectorAll("h1,h2,h3,h4")].map((h) => Number(h.tagName[1]));
    levels.reduce((previous, level) => {
      expect(level - previous, `h${previous} → h${level}`).toBeLessThanOrEqual(1);
      return level;
    }, 0);
  });

  it("no tiene encabezados vacíos y los enlaces tienen destino real", () => {
    const { container } = renderPage(page.path);
    for (const heading of container.querySelectorAll("h1,h2,h3")) {
      expect(heading.textContent?.trim()).not.toBe("");
    }
    for (const link of container.querySelectorAll("a")) {
      expect(link.getAttribute("href")).toBeTruthy();
    }
  });
});
