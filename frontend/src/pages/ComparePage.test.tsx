import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { CoverageComparison } from "../lib/types";
import { ComparePage } from "./ComparePage";

vi.mock("../lib/api", () => ({
  api: { compareCoverage: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const rows: CoverageComparison[] = [
  {
    vehicle_id: 1,
    vehicle_label: "Family car",
    insurer: "Sample Insurance",
    policy_type: "comprehensive",
    own_damage: true,
    third_party: true,
    personal_accident: false,
    add_ons: ["Roadside assistance"],
    start_date: "2026-01-01",
    end_date: "2026-12-31",
  },
];

describe("ComparePage", () => {
  beforeEach(() => vi.mocked(api.compareCoverage).mockResolvedValue(rows));

  it("compares saved cover and add-ons", async () => {
    render(
      <MemoryRouter>
        <ComparePage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Coverage at a glance" });
    expect(screen.getByText("Roadside assistance")).toBeInTheDocument();
    expect(
      screen.getByText("Compare what’s recorded—not a claim decision."),
    ).toBeInTheDocument();
  });
});
