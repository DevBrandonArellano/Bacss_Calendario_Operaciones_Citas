import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Tarjeta de sección del Dashboard: título (H2), subtítulo, acción y contenido. */
export function ChartCard({ title, subtitle, action, className, children }: ChartCardProps) {
  return (
    <Card className={cn("flex h-full flex-col gap-5", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold text-ink">{title}</h2>
          {subtitle && <p className="m-0 mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 text-sm">{action}</div>}
      </header>
      <div className="flex-1">{children}</div>
    </Card>
  );
}
