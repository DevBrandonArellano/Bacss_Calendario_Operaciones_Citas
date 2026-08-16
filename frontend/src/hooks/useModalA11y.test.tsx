import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useModalA11y } from "@/hooks/useModalA11y";

function TestModal({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useModalA11y(containerRef, onClose);

  return (
    <div>
      <button type="button">Abrir</button>
      <div ref={containerRef} role="dialog" aria-modal="true">
        <button type="button">Primero</button>
        <button type="button">Segundo</button>
      </div>
    </div>
  );
}

describe("useModalA11y", () => {
  it("cierra el diálogo al presionar Escape", () => {
    const onClose = vi.fn();
    render(<TestModal onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("atrapa el foco: Tab desde el último elemento vuelve al primero", () => {
    render(<TestModal onClose={vi.fn()} />);

    const last = screen.getByText("Segundo");
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByText("Primero"));
  });

  it("atrapa el foco: Shift+Tab desde el primer elemento vuelve al último", () => {
    render(<TestModal onClose={vi.fn()} />);

    const first = screen.getByText("Primero");
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(screen.getByText("Segundo"));
  });

  it("devuelve el foco al elemento que abrió el diálogo cuando se desmonta", () => {
    const opener = document.createElement("button");
    opener.textContent = "Abrir externo";
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<TestModal onClose={vi.fn()} />);
    unmount();

    expect(document.activeElement).toBe(opener);
    document.body.removeChild(opener);
  });
});
