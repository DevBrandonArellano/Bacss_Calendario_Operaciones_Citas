import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarChart, type ChartDatum } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";

const DATA: ChartDatum[] = [
  { label: "22 oct", value: 2, description: "22 oct: 2 citas" },
  { label: "23 oct", value: 0, description: "23 oct: 0 citas" },
  { label: "24 oct", value: 5, description: "24 oct: 5 citas" },
];

describe.each([
  ["BarChart", BarChart],
  ["LineChart", LineChart],
])("%s", (_name, Chart) => {
  it("expone cada punto con su descripción completa como nombre accesible", () => {
    render(<Chart data={DATA} ariaLabel="Citas por día" />);

    expect(screen.getByRole("group", { name: "Citas por día" })).toBeInTheDocument();
    for (const datum of DATA) {
      expect(screen.getByRole("button", { name: datum.description })).toBeInTheDocument();
    }
  });

  it("muestra el tooltip al enfocar un punto y lo oculta al salir", () => {
    render(<Chart data={DATA} ariaLabel="Citas por día" />);
    const point = screen.getByRole("button", { name: "24 oct: 5 citas" });

    fireEvent.focus(point);
    expect(screen.getAllByText("24 oct: 5 citas").length).toBeGreaterThan(0);
    expect(document.querySelectorAll('span[aria-hidden="true"].pointer-events-none')).toHaveLength(1);

    fireEvent.blur(point);
    expect(document.querySelectorAll('span[aria-hidden="true"].pointer-events-none')).toHaveLength(0);
  });

  it("solo un punto es tabulable y las flechas recorren el resto", () => {
    render(<Chart data={DATA} ariaLabel="Citas por día" />);
    const points = DATA.map((d) => screen.getByRole("button", { name: d.description }));

    expect(points.filter((p) => p.tabIndex === 0)).toHaveLength(1);

    points[0].focus();
    fireEvent.keyDown(points[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(points[1]);

    fireEvent.keyDown(points[1], { key: "End" });
    expect(document.activeElement).toBe(points[2]);

    fireEvent.keyDown(points[2], { key: "Home" });
    expect(document.activeElement).toBe(points[0]);
  });
});
