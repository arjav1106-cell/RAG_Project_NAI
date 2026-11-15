import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { GrievanceGuidance } from "../lib/types";
import { SupportPage } from "./SupportPage";

vi.mock("../lib/api", () => ({
  api: { grievanceGuidance: vi.fn() },
  ApiError: class ApiError extends Error {},
}));

const guidance: GrievanceGuidance = {
  steps: ["Write to your insurer's grievance officer."],
  official_url: "https://bimabharosa.irdai.gov.in/Home/FAQ",
  safety_note: "The portal does not ask for payment.",
  source_checked: "2026-11-15",
};

describe("SupportPage", () => {
  beforeEach(() =>
    vi.mocked(api.grievanceGuidance).mockResolvedValue(guidance),
  );

  it("shows grievance steps and links to the official portal", async () => {
    render(
      <MemoryRouter>
        <SupportPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Write to your insurer's grievance officer."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open irdai bima bharosa/i }),
    ).toHaveAttribute("href", guidance.official_url);
    expect(
      screen.getByText("Official FAQ checked 2026-11-15"),
    ).toBeInTheDocument();
  });
});
