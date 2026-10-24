import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** `error` se anuncia a lectores de pantalla y usa el color de error. */
  tone?: "neutral" | "error";
  compact?: boolean;
  className?: string;
}

/** Estado vacío / error diseñado: icono, explicación breve y acciones que resuelven la situación. */
export function EmptyState({ icon: Icon, title, description, actions, tone = "neutral", compact, className }: EmptyStateProps) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className
      )}
    >
      <span
        className={cn(
          "grid place-items-center rounded-2xl",
          compact ? "size-10" : "size-12",
          tone === "error" ? "bg-negative-soft text-negative" : "bg-brand-soft text-brand"
        )}
        aria-hidden="true"
      >
        <Icon className={compact ? "size-5" : "size-6"} />
      </span>
      <p className="m-0 text-base font-semibold text-ink">{title}</p>
      {description && <p className="m-0 max-w-md text-sm text-muted">{description}</p>}
      {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
