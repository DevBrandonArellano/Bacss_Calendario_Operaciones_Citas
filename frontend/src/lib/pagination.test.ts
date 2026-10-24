import { describe, expect, it, vi } from "vitest";

import { fetchAllPages } from "@/lib/pagination";
import type { Paginated } from "@/types/api";

function pageOf(items: number[], count: number, hasNext: boolean): Paginated<number> {
  return { count, next: hasNext ? "next" : null, previous: null, results: items };
}

describe("fetchAllPages", () => {
  it("una sola página no hace peticiones extra", async () => {
    const fetchPage = vi.fn().mockResolvedValue(pageOf([1, 2], 2, false));
    const result = await fetchAllPages(fetchPage);
    expect(result).toEqual({ results: [1, 2], total: 2, truncated: false });
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("concatena todas las páginas en orden", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(pageOf([1, 2], 5, true))
      .mockResolvedValueOnce(pageOf([3, 4], 5, true))
      .mockResolvedValueOnce(pageOf([5], 5, false));
    const result = await fetchAllPages(fetchPage);
    expect(result.results).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
  });

  it("corta en el tope de páginas y avisa de que quedó incompleto", async () => {
    const fetchPage = vi.fn().mockResolvedValue(pageOf([1], 999, true));
    const result = await fetchAllPages(fetchPage, 3);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(999);
  });

  it("propaga el error de red en vez de devolver datos parciales", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(pageOf([1], 2, true))
      .mockRejectedValueOnce(new Error("red"));
    await expect(fetchAllPages(fetchPage)).rejects.toThrow("red");
  });
});
