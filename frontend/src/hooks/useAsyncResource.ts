import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T; refreshing: boolean };

/**
 * Carga un recurso asíncrono con estados explícitos (cargando / error / listo) y protección
 * contra respuestas antiguas: si `loader` cambia mientras hay una petición en curso (p. ej. el
 * usuario cambia de período), la respuesta vieja se descarta y no pisa la selección actual.
 *
 * `loader` debe estar memorizado (useCallback) con sus dependencias; al cambiar, se recarga.
 * Mientras se recarga con datos previos, se conservan (`refreshing`) para evitar parpadeos.
 */
export function useAsyncResource<T>(loader: () => Promise<T>, enabled = true): [AsyncState<T>, () => void] {
  const [state, setState] = useState<AsyncState<T>>({ status: enabled ? "loading" : "idle" });
  const [reloadToken, setReloadToken] = useState(0);
  const latestRequest = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }

    const requestId = ++latestRequest.current;
    setState((previous) =>
      previous.status === "ready" ? { ...previous, refreshing: true } : { status: "loading" }
    );

    loader()
      .then((data) => {
        if (requestId === latestRequest.current) setState({ status: "ready", data, refreshing: false });
      })
      .catch((error: unknown) => {
        if (requestId === latestRequest.current) setState({ status: "error", error });
      });

    return () => {
      latestRequest.current += 1;
    };
  }, [loader, enabled, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  return [state, reload];
}
