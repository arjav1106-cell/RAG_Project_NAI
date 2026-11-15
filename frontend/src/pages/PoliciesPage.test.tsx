import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { Payment, Policy, Vehicle } from "../lib/types";
import { PoliciesPage } from "./PoliciesPage";

vi.mock("../lib/api", () => ({
  api: {
    vehicles: vi.fn(),
    policies: vi.fn(),
    documents: vi.fn(),
    payments: vi.fn(),
    createPayment: vi.fn(),
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
  add_ons: ["roadside assistance"],
  notes: "",
  created_at: "2026-01-01T00:00:00Z",
};

describe("PoliciesPage", () => {
  let payments: Payment[];

  beforeEach(() => {
    payments = [];
    vi.mocked(api.vehicles).mockResolvedValue([vehicle]);
    vi.mocked(api.policies).mockResolvedValue([policy]);
    vi.mocked(api.documents).mockResolvedValue([]);
    vi.mocked(api.payments).mockImplementation(async () => payments);
    vi.mocked(api.createPayment).mockImplementation(
      async (policyId, payload) => {
        const payment: Payment = {
          id: 3,
          policy_id: policyId,
          paid_on: payload.paid_on ?? "",
          amount: payload.amount ?? 0,
          status: "paid",
          reference: payload.reference ?? "",
          notes: "",
          created_at: "2026-02-01T00:00:00Z",
        };
        payments = [payment];
        return payment;
      },
    );
  });

  it("records and displays a premium payment", async () => {
    const user = userEvent.setup();
    render(<PoliciesPage />);

    await screen.findByText("Sample Insurance");
    await user.click(
      screen.getByRole("button", { name: /record a premium payment/i }),
    );
    fireEvent.change(screen.getByLabelText("Paid on"), {
      target: { value: "2026-02-01" },
    });
    await user.type(screen.getByLabelText("Amount (₹)"), "18500");
    await user.type(screen.getByLabelText("Reference"), "TXN-123");
    await user.click(screen.getByRole("button", { name: "Save payment" }));

    expect(await screen.findByText("Payment recorded.")).toBeInTheDocument();
    expect(screen.getByText("TXN-123")).toBeInTheDocument();
    expect(api.createPayment).toHaveBeenCalledWith(2, {
      paid_on: expect.stringMatching(/2026-02-01/),
      amount: 18500,
      status: "paid",
      reference: "TXN-123",
    });
  });
});
