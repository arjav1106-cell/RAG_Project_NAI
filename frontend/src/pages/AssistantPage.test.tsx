import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { AssistantResponse, Policy, Vehicle } from "../lib/types";
import { AssistantPage } from "./AssistantPage";

vi.mock("../lib/api", () => ({
  api: {
    vehicles: vi.fn(),
    policies: vi.fn(),
    ask: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
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
const response: AssistantResponse = {
  answer: "Your tracker shows an annual premium of ₹18,500. [C1]",
  citations: [
    {
      citation_id: "C1",
      title: "Your vehicle insurance tracker",
      publisher: "Vahana tracker",
      url: null,
      document_id: null,
      location: "Saved account records",
      excerpt: "Annual premium: 18500 INR.",
    },
  ],
  insufficient_evidence: false,
  disclaimer: "Informational explanation only.",
};

describe("AssistantPage", () => {
  beforeEach(() => {
    vi.mocked(api.vehicles).mockResolvedValue([vehicle]);
    vi.mocked(api.policies).mockResolvedValue([policy]);
    vi.mocked(api.ask).mockResolvedValue(response);
  });

  it("asks within the selected policy and displays its source citation", async () => {
    const user = userEvent.setup();
    render(<AssistantPage />);

    await screen.findByRole("heading", { name: "Policy assistant" });
    await user.selectOptions(screen.getByLabelText("Search in"), "policy:2");
    await user.type(
      screen.getByLabelText("Ask your policy question"),
      "What premium is in my tracker?",
    );
    await user.click(screen.getByRole("button", { name: "Send question" }));

    expect(await screen.findByText(response.answer)).toBeInTheDocument();
    expect(
      screen.getByText("Your vehicle insurance tracker"),
    ).toBeInTheDocument();
    expect(api.ask).toHaveBeenCalledWith(
      "What premium is in my tracker?",
      undefined,
      policy.id,
    );
  });
});
