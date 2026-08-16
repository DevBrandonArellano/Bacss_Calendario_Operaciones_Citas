import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SimpleBarChart } from "@/features/reports/SimpleBarChart";

describe("SimpleBarChart", () => {
  it("muestra las etiquetas y valores de cada barra", () => {
    render(
      <SimpleBarChart
        title="Citas por día"
        data={[
          { label: "2026-01-01", value: 3 },
          { label: "2026-01-02", value: 5 },
        ]}
      />
    );

    expect(screen.getByText("Citas por día")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay datos", () => {
    render(<SimpleBarChart title="Vacío" data={[]} />);
    expect(screen.getByText("Sin datos en este rango.")).toBeInTheDocument();
  });
});
