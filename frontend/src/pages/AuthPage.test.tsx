import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../lib/AuthProvider";
import { api, ApiError } from "../lib/api";
import { AuthPage } from "./AuthPage";

vi.mock("../lib/api", () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

const testUser = {
  id: 1,
  email: "driver@example.com",
  created_at: "2026-01-01T00:00:00Z",
};

function renderAuthPage(createAccount = false) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AuthPage createAccount={createAccount} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("AuthPage", () => {
  beforeEach(() => {
    vi.mocked(api.me).mockRejectedValue(new Error("Signed out"));
    vi.mocked(api.login).mockResolvedValue(testUser);
    vi.mocked(api.register).mockResolvedValue(testUser);
  });

  it("switches from sign-in to registration", async () => {
    const user = userEvent.setup();
    renderAuthPage();
    await screen.findByRole("heading", { name: "Welcome back" });
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "minLength",
      "10",
    );
  });

  it("submits a registration and calls the API", async () => {
    const user = userEvent.setup();
    renderAuthPage(true);
    await user.type(
      await screen.findByLabelText("Email address"),
      "driver@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "StrongPass-2026");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(api.register).toHaveBeenCalledWith(
        "driver@example.com",
        "StrongPass-2026",
      ),
    );
  });

  it("shows server errors in the form", async () => {
    vi.mocked(api.login).mockRejectedValue(
      new ApiError("Email or password is incorrect", 401),
    );
    renderAuthPage();
    await screen.findByRole("heading", { name: "Welcome back" });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "wrong@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrectpass" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect",
    );
  });
});
