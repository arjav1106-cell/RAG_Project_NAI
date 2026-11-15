import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { GaragePage } from "./GaragePage";

vi.mock("../lib/api", () => ({
  api: {
    vehicles: vi.fn(),
    policies: vi.fn(),
    createVehicle: vi.fn(),
    updateVehicle: vi.fn(),
    deleteVehicle: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

describe("GaragePage", () => {
  let garage: Awaited<ReturnType<typeof api.vehicles>>;

  beforeEach(() => {
    garage = [];
    vi.mocked(api.vehicles).mockImplementation(async () => garage);
    vi.mocked(api.policies).mockResolvedValue([]);
    vi.mocked(api.createVehicle).mockImplementation(async (payload) => {
      const vehicle = { id: 1, ...payload, created_at: "2026-01-01T00:00:00Z" };
      garage = [vehicle];
      return vehicle;
    });
  });

  it("adds a vehicle and displays it in the garage", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GaragePage />
      </MemoryRouter>,
    );
    await screen.findByText("Your garage is ready");
    await user.click(screen.getByRole("button", { name: /add a vehicle/i }));
    await user.type(
      screen.getByLabelText("Name in your garage"),
      "Weekend ride",
    );
    await user.selectOptions(screen.getByLabelText("Vehicle type"), "scooter");
    await user.type(screen.getByLabelText("Make"), "Honda");
    await user.type(screen.getByLabelText("Model"), "Activa");
    await user.click(screen.getByRole("button", { name: "Save vehicle" }));
    await waitFor(() => expect(api.createVehicle).toHaveBeenCalled());
    expect(
      await screen.findByRole("heading", { name: "Weekend ride" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Honda · Activa")).toBeInTheDocument();
  });
});
