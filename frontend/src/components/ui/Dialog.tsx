import { useId, useRef, type ReactNode } from "react";

import { useModalA11y } from "@/hooks/useModalA11y";

interface DialogProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Diálogo modal centrado con el mismo comportamiento accesible que el panel lateral. */
export function Dialog({ title, description, onClose, children, footer }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalA11y(dialogRef, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-(--color-overlay) p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full flex-col rounded-t-2xl border border-line bg-raised shadow-float sm:max-w-lg sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-6 pt-6">
          <h2 id={titleId} className="m-0 text-lg font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}
