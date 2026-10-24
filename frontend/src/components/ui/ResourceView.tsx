import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AsyncState } from "@/hooks/useAsyncResource";
import { cn } from "@/lib/cn";

interface ResourceViewProps<T> {
  state: AsyncState<T>;
  errorTitle: string;
  onRetry: () => void;
  /** Alto del esqueleto, para que la tarjeta no cambie de tamaño al cargar. */
  skeletonClassName?: string;
  children: (data: T) => ReactNode;
}

/**
 * Presenta los cuatro estados de un recurso: cargando (esqueleto), error (con reintento),
 * inactivo (nada) y listo. Un error de red nunca se muestra como «no hay datos».
 */
export function ResourceView<T>({ state, errorTitle, onRetry, skeletonClassName, children }: ResourceViewProps<T>) {
  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite" className={cn("animate-pulse rounded-xl bg-subtle", skeletonClassName ?? "h-56")}>
        <span className="sr-only">Cargando...</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        compact
        tone="error"
        icon={AlertTriangle}
        title={errorTitle}
        description="Comprueba tu conexión e inténtalo de nuevo."
        actions={
          <Button size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        }
      />
    );
  }

  return <>{children(state.data)}</>;
}
