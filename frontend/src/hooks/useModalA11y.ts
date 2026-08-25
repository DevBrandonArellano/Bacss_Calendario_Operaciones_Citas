import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento accesible estándar de diálogo modal (WAI-ARIA APG):
 * Escape cierra, Tab queda atrapado dentro del diálogo, y el foco vuelve
 * al elemento que lo abrió al desmontar. Sin esto, un usuario de teclado
 * puede tabular hacia contenido oculto detrás del backdrop.
 */
export function useModalA11y(containerRef: RefObject<HTMLElement>, onClose: () => void) {
  // `onClose` suele recrearse en cada render del componente que abre el diálogo.
  // Guardarlo en una ref permite que el efecto corra una sola vez por montaje:
  // si dependiera de `onClose`, se re-suscribiría en cada render y capturaría
  // como "foco previo" lo que estuviera enfocado en ese momento (el propio
  // diálogo), rompiendo la devolución del foco al cerrar.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function getFocusable(): HTMLElement[] {
      const container = containerRef.current;
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [containerRef]);
}
