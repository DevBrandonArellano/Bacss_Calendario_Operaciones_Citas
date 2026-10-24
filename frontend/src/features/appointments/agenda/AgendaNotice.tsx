import { CheckCircle2, Info, X } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/cn";

export interface Notice {
  tone: "success" | "info";
  text: string;
  link?: { to: string; label: string };
}

const AUTO_DISMISS_MS = 8000;

/** Confirmación del resultado de una operación; se anuncia a lectores de pantalla y se cierra sola. */
export function AgendaNotice({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  const Icon = notice.tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex items-center gap-3 rounded-card border px-4 py-3 text-sm",
        notice.tone === "success" ? "border-status-confirmed bg-status-confirmed-soft text-status-confirmed-fg" : "border-line bg-subtle text-ink"
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <p className="m-0 flex-1">
        {notice.text}{" "}
        {notice.link && (
          <Link to={notice.link.to} className="font-semibold">
            {notice.link.label}
          </Link>
        )}
      </p>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={onDismiss}
        className="grid size-7 min-h-0 place-items-center rounded-lg border-0 bg-transparent p-0 shadow-none hover:bg-black/5"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
