import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAsyncResource } from "@/hooks/useAsyncResource";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAsyncResource", () => {
  it("pasa de cargando a listo con los datos", async () => {
    const loader = () => Promise.resolve(42);
    const { result } = renderHook(() => useAsyncResource(loader));

    expect(result.current[0].status).toBe("loading");
    await waitFor(() => expect(result.current[0]).toEqual({ status: "ready", data: 42, refreshing: false }));
  });

  it("distingue un error de una respuesta vacía", async () => {
    const loader = () => Promise.reject(new Error("red"));
    const { result } = renderHook(() => useAsyncResource(loader));

    await waitFor(() => expect(result.current[0].status).toBe("error"));
  });

  it("no ejecuta nada cuando está deshabilitado", () => {
    let calls = 0;
    const loader = () => {
      calls += 1;
      return Promise.resolve(1);
    };
    const { result } = renderHook(() => useAsyncResource(loader, false));

    expect(result.current[0].status).toBe("idle");
    expect(calls).toBe(0);
  });

  it("descarta una respuesta antigua que llega después de cambiar el loader", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(({ loader }) => useAsyncResource(loader), {
      initialProps: { loader: () => first.promise },
    });

    rerender({ loader: () => second.promise });
    await act(async () => {
      second.resolve("nuevo");
    });
    await act(async () => {
      first.resolve("viejo");
    });

    expect(result.current[0]).toEqual({ status: "ready", data: "nuevo", refreshing: false });
  });

  it("conserva los datos previos mientras recarga (sin parpadeo)", async () => {
    const next = deferred<number>();
    let call = 0;
    const loader = () => (call++ === 0 ? Promise.resolve(1) : next.promise);
    const { result } = renderHook(() => useAsyncResource(loader));
    await waitFor(() => expect(result.current[0].status).toBe("ready"));

    act(() => result.current[1]());

    await waitFor(() => expect(result.current[0]).toEqual({ status: "ready", data: 1, refreshing: true }));
    await act(async () => {
      next.resolve(2);
    });
    expect(result.current[0]).toEqual({ status: "ready", data: 2, refreshing: false });
  });
});
