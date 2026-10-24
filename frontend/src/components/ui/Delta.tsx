import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/cn";
import type { PercentChange } from "@/lib/format";

const STYLES = {
  up: { icon: ArrowUpRight, tone: "text-positive", verb: "más" },
  down: { icon: ArrowDownRight, tone: "text-negative", verb: "menos" },
  flat: { icon: ArrowRight, tone: "text-muted", verb: "igual" },
} as const;

/** Variación frente al período anterior. Texto + icono: el color no es la única señal. */
export function Delta({ change, comparedTo }: { change: PercentChange; comparedTo: string }) {
  const { icon: Icon, tone, verb } = STYLES[change.direction];
  const amount = Math.abs(change.percent);
  const text = change.direction === "flat" ? "Sin cambios" : `${amount}% ${verb}`;

  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs text-muted">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>
        <Icon className="size-3.5" aria-hidden="true" />
        {text}
      </span>
      {comparedTo}
    </span>
  );
}
