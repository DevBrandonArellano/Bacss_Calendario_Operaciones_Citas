import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { publicRoutes } from "@/routes/publicRoutes";
import { PUBLIC_PAGES } from "@/seo/pages";

function tree(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>{publicRoutes}</Routes>
    </MemoryRouter>
  );
}

describe("hidratación del HTML pre-renderizado", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(PUBLIC_PAGES.map((page) => page.path))("%s hidrata sin desajustes", async (path) => {
    const container = document.createElement("div");
    // El spy se instala después de renderizar: los avisos de useLayoutEffect de React Router en
    // modo desarrollo durante renderToString no son errores de hidratación.
    container.innerHTML = renderToString(tree(path));
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await act(async () => {
      hydrateRoot(container, tree(path));
    });

    expect(consoleError).not.toHaveBeenCalled();
    container.remove();
  });
});
