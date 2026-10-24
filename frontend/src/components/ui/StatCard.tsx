import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Línea de contexto bajo el valor (desglose, variación...). */
  detail?: ReactNode;
  /** Pie con una acción (enlace). Todas las tarjetas reservan el mismo alto. */
  footer?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, detail, footer, className }: StatCardProps) {
  return (
    <Card className={cn("flex h-full flex-col gap-3 p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-muted">{label}</span>
          <span className="truncate text-3xl font-bold tracking-tight text-ink tabular-nums">{value}</span>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden="true">
          <Icon className="size-5" />
        </span>
      </div>
      <div className="min-h-9 text-sm text-muted">{detail}</div>
      {footer && <div className="mt-auto border-t border-line pt-3 text-sm">{footer}</div>}
    </Card>
  );
}
