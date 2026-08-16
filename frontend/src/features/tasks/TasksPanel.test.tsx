import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { TasksPanel } from "@/features/tasks/TasksPanel";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

describe("TasksPanel", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });

  it("muestra las tareas devueltas por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: "task-1",
            owner_type: "customer",
            owner_id: "cust-1",
            title: "Llamar al cliente",
            description: "",
            assigned_to_user: null,
            due_date: "2026-02-01",
            priority: "medium",
            status: "pending",
            created_at: "2026-01-01T10:00:00Z",
          },
        ],
      },
    });

    render(<TasksPanel ownerType="customer" ownerId="cust-1" />);

    await waitFor(() => expect(screen.getByText("Llamar al cliente")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Marcar completada" })).toBeInTheDocument();
  });

  it("marca una tarea como completada", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: "task-1",
              owner_type: "customer",
              owner_id: "cust-1",
              title: "Llamar al cliente",
              description: "",
              assigned_to_user: null,
              due_date: null,
              priority: "medium",
              status: "pending",
              created_at: "2026-01-01T10:00:00Z",
            },
          ],
        },
      })
      .mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
    vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: {} });

    render(<TasksPanel ownerType="customer" ownerId="cust-1" />);
    const button = await screen.findByRole("button", { name: "Marcar completada" });
    fireEvent.click(button);

    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledWith("/tasks/task-1/", { status: "completed" })
    );
  });

  it("muestra un mensaje cuando no hay tareas", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    });

    render(<TasksPanel ownerType="customer" ownerId="cust-1" />);

    await waitFor(() => expect(screen.getByText("Sin tareas todavía.")).toBeInTheDocument());
  });
});
