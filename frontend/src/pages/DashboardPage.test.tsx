import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { Dashboard, Policy } from "../lib/types";
import { DashboardPage } from "./DashboardPage";

vi.mock("../lib/api", () => ({
  api: { dashboard: vi.fn(), policies: vi.fn() },
}));

const dashboard: Dashboard = {
  vehicle_count: 1,
  active_policy_count: 1,
  open_claim_count: 0,
  reminders: [
    {
      kind: "renewal",
      severity: "warning",
      vehicle_id: 1,
      vehicle_label: "Family car",
      policy_id: 2,
      message: "Own-damage cover expires in 12 days.",
      due_date: "2026-11-27",
    },
  ],
  vehicles: [],
};
const policies: Policy[] = [
  {
    id: 2,
    vehicle_id: 1,
    insurer: "Sample Insurance",
    policy_number: "POL-123",
    policy_type: "comprehensive",
    own_damage: true,
    third_party: true,
    personal_accident: false,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    own_damage_start_date: null,
    own_damage_end_date: null,
    third_party_start_date: null,
    third_party_end_date: null,
    premium_amount: 18500,
    payment_frequency: "annual",
    add_ons: [],
    notes: "",
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard);
    vi.mocked(api.policies).mockResolvedValue(policies);
  });

  it("shows tracked totals and upcoming renewal reminders", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Welcome to Vahana" });
    expect(
      screen.getByText("Own-damage cover expires in 12 days."),
    ).toBeInTheDocument();
    expect(screen.getByText("Premium amounts tracked")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage garage/i }),
    ).toHaveAttribute("href", "/garage");
  });
});
