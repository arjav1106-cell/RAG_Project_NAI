import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { Claim, Policy, Vehicle } from "../lib/types";
import { ClaimsPage } from "./ClaimsPage";

vi.mock("../lib/api", () => ({
  api: {
    vehicles: vi.fn(),
    policies: vi.fn(),
    claims: vi.fn(),
    documents: vi.fn(),
    createClaim: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
  documentUrl: (id: number) => `/api/documents/${id}/download`,
}));

const vehicle: Vehicle = {
  id: 1,
  vehicle_type: "car",
  label: "Family car",
  registration_number: "KA01AB1234",
  make: "Tata",
  model: "Altroz",
  year: 2024,
  created_at: "2026-01-01T00:00:00Z",
};
const policy: Policy = {
  id: 2,
  vehicle_id: vehicle.id,
  insurer: "Sample Insurance",
  policy_number: "POL-123",
  policy_type: "comprehensive",
  own_damage: true,
  third_party: true,
  personal_accident: true,
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
};

describe("ClaimsPage", () => {
  let claims: Claim[];

  beforeEach(() => {
    claims = [];
    vi.mocked(api.vehicles).mockResolvedValue([vehicle]);
    vi.mocked(api.policies).mockResolvedValue([policy]);
    vi.mocked(api.claims).mockImplementation(async () => claims);
    vi.mocked(api.documents).mockResolvedValue([]);
    vi.mocked(api.createClaim).mockImplementation(async (policyId, payload) => {
      const claim: Claim = {
        id: 5,
        policy_id: policyId,
        incident_date: payload.incident_date ?? null,
        description: payload.description ?? "",
        status: "reported",
        claim_amount: payload.claim_amount ?? null,
        notes: payload.notes ?? "",
        created_at: "2026-02-01T00:00:00Z",
      };
      claims = [claim];
      return claim;
    });
  });

  it("records a claim against a selected policy", async () => {
    const user = userEvent.setup();
    render(<ClaimsPage />);

    await screen.findByText("No claims in your history");
    await user.click(
      screen.getAllByRole("button", { name: /record a claim/i })[0],
    );
    fireEvent.change(screen.getByLabelText("Incident date"), {
      target: { value: "2026-01-31" },
    });
    await user.type(
      screen.getByLabelText("What happened?"),
      "Rear bumper damaged in a collision.",
    );
    await user.type(
      screen.getByLabelText("Claim amount (₹), if known"),
      "12000",
    );
    await user.click(screen.getByRole("button", { name: "Save claim" }));

    expect(
      await screen.findByText("Rear bumper damaged in a collision."),
    ).toBeInTheDocument();
    expect(api.createClaim).toHaveBeenCalledWith(2, {
      incident_date: "2026-01-31",
      description: "Rear bumper damaged in a collision.",
      claim_amount: 12000,
      notes: "",
    });
  });
});
