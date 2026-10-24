import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { useModalA11y } from "@/hooks/useModalA11y";

interface DrawerProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Panel lateral modal (pantalla completa en móvil). Escape cierra, el foco queda atrapado
 * y vuelve al elemento que lo abrió (useModalA11y). Clic en el fondo también cierra.
 */
export function Drawer({ title, onClose, children, footer }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalA11y(panelRef, onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-(--color-overlay)" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full flex-col border-l border-line bg-raised shadow-float sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-6">
          <h2 id={titleId} className="m-0 text-lg font-semibold text-ink">
            {title}
          </h2>
          <Button variant="ghost" size="sm" aria-label="Cerrar panel" onClick={onClose}>
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <footer className="shrink-0 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
