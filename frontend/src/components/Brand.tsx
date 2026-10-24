import { CalendarCheck } from "lucide-react";

import { cn } from "@/lib/cn";

export const BRAND_NAME = "Bacss Citas";

interface BrandProps {
  className?: string;
  tone?: "default" | "onHero";
  /** Solo la marca gráfica (barra lateral colapsada). */
  compact?: boolean;
}

export function Brand({ className, tone = "default", compact }: BrandProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-lg font-bold tracking-tight", className)}>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-xl",
          tone === "onHero" ? "bg-white/20 text-on-hero-ink" : "bg-brand text-on-brand"
        )}
        aria-hidden="true"
      >
        <CalendarCheck className="size-5" />
      </span>
      {compact ? <span className="sr-only">{BRAND_NAME}</span> : BRAND_NAME}
    </span>
  );
}
