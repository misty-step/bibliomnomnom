import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
}));

import { useQuery } from "convex/react";
import { useToast } from "@/hooks/use-toast";
import { captureError } from "@/lib/sentry";
import SettingsPageClient from "./SettingsPageClient";

describe("SettingsPageClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ toast: vi.fn() });
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("renders loading state while subscription is loading", () => {
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const { container } = render(
      <SettingsPageClient priceIds={{ monthly: "price_monthly", annual: "price_annual" }} />,
    );

    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders empty state when there is no subscription", () => {
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);

    render(<SettingsPageClient priceIds={{ monthly: "price_monthly", annual: "price_annual" }} />);

    expect(screen.getByRole("heading", { name: "No subscription found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View pricing" })).toHaveAttribute("href", "/pricing");
  });

  it("renders subscription details and manage button when subscription exists", () => {
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: "active",
      cancelAtPeriodEnd: false,
      priceId: "price_monthly",
      stripeCustomerId: "cus_123",
      currentPeriodEnd: Date.UTC(2026, 0, 1),
      trialEndsAt: null,
      daysRemaining: 10,
    });

    render(<SettingsPageClient priceIds={{ monthly: "price_monthly", annual: "price_annual" }} />);

    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage Subscription" })).toBeInTheDocument();
  });

  it("shows an error state and reports when billing portal request fails", async () => {
    const toast = vi.fn();
    (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ toast });
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      status: "active",
      cancelAtPeriodEnd: false,
      priceId: "price_monthly",
      stripeCustomerId: "cus_123",
      currentPeriodEnd: Date.UTC(2026, 0, 1),
      trialEndsAt: null,
      daysRemaining: 10,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: "Nope" }),
    }) as unknown as typeof fetch;

    render(<SettingsPageClient priceIds={{ monthly: "price_monthly", annual: "price_annual" }} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Manage Subscription" }));

    await waitFor(() => expect(screen.getByText("Nope")).toBeInTheDocument());

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Could not open billing portal",
        variant: "destructive",
      }),
    );

    expect(captureError).toHaveBeenCalled();
  });
});
