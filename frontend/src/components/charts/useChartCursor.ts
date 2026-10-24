import { useRef, useState, type KeyboardEvent } from "react";

/**
 * Cursor de un gráfico con teclado: un solo punto de tabulación para todo el gráfico y flechas
 * (← → Inicio Fin) para recorrer los puntos, en vez de decenas de paradas de Tab.
 * `active` es el punto bajo el ratón o con foco (para mostrar su tooltip).
 */
export function useChartCursor(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const [tabStop, setTabStop] = useState(0);
  const items = useRef<(HTMLElement | null)[]>([]);

  function moveTo(index: number) {
    const next = Math.min(Math.max(index, 0), count - 1);
    setTabStop(next);
    items.current[next]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent) {
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: count - 1,
    };
    if (event.key in targets) {
      event.preventDefault();
      moveTo(targets[event.key]);
    }
  }

  function itemProps(index: number) {
    return {
      ref: (element: HTMLElement | null) => {
        items.current[index] = element;
      },
      tabIndex: index === Math.min(tabStop, count - 1) ? 0 : -1,
      onFocus: () => {
        setActive(index);
        setTabStop(index);
      },
      onBlur: () => setActive(null),
      onMouseEnter: () => setActive(index),
      onMouseLeave: () => setActive(null),
      onKeyDown: (event: KeyboardEvent) => handleKeyDown(index, event),
    };
  }

  return { active, itemProps };
}
