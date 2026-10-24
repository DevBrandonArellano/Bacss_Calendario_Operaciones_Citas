import { useId, type ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  /** Recibe el `id` y los `aria-*` que debe aplicar al control para asociarlo a su etiqueta y ayuda. */
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}

/** Etiqueta + control + ayuda/error asociados (WCAG 1.3.1 / 3.3.1). */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-msg`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-describedby": message ? messageId : undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {message && (
        <p id={messageId} className={error ? "m-0 text-sm text-negative" : "m-0 text-sm text-muted"}>
          {message}
        </p>
      )}
    </div>
  );
}
