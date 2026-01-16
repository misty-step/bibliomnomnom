import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const useQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => useQueryMock(),
}));

// Mock next/link to avoid router context issues
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { TrialBanner } from "../../../components/subscription/TrialBanner";

describe("TrialBanner", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("renders nothing when loading", () => {
      useQueryMock.mockReturnValue(undefined);

      const { container } = render(<TrialBanner />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("active subscription", () => {
    it("renders nothing when user has active subscription", () => {
      useQueryMock.mockReturnValue({
        hasAccess: true,
        status: "active",
        daysRemaining: 25,
      });

      const { container } = render(<TrialBanner />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("no subscription", () => {
    it("shows trial prompt for users without subscription", () => {
      useQueryMock.mockReturnValue({
        hasAccess: false,
        reason: "no_subscription",
      });

      render(<TrialBanner />);

      expect(screen.getByText("Welcome!")).toBeInTheDocument();
      expect(screen.getByText(/Start your 14-day free trial/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Get Started/i })).toHaveAttribute(
        "href",
        "/pricing",
      );
    });

    it("has dismiss button for no subscription state", () => {
      useQueryMock.mockReturnValue({
        hasAccess: false,
        reason: "no_subscription",
      });

      render(<TrialBanner />);

      expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
    });

    it("dismisses banner when clicking X", () => {
      useQueryMock.mockReturnValue({
        hasAccess: false,
        reason: "no_subscription",
      });

      render(<TrialBanner />);

      fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

      expect(screen.queryByText("Welcome!")).not.toBeInTheDocument();
    });
  });

  describe("trialing (> 3 days remaining)", () => {
    it("shows days remaining for trial", () => {
      useQueryMock.mockReturnValue({
        hasAccess: true,
        status: "trialing",
        daysRemaining: 10,
      });

      render(<TrialBanner />);

      expect(screen.getByText(/10 days left/)).toBeInTheDocument();
      expect(screen.getByText(/in your free trial/)).toBeInTheDocument();
    });

    it("uses correct pluralization for 1 day", () => {
      useQueryMock.mockReturnValue({
        hasAccess: true,
        status: "trialing",
        daysRemaining: 1,
      });

      render(<TrialBanner />);

      expect(screen.getByText(/1 day left/)).toBeInTheDocument();
    });

    it("has dismiss button when not urgent", () => {
      useQueryMock.mockReturnValue({
        hasAccess: true,
        status: "trialing",
        daysRemaining: 10,
      });

      render(<TrialBanner />);

      expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
    });

    it("shows Become a Member link", () => {
      useQueryMock.mockReturnValue({
        hasAccess: true,
        status: "trialing",
        daysRemaining: 10,
      });

      render(<TrialBanner />);

      expect(screen.getByRole("link", { name: /Become a Member/i })).toHaveAttribute(
        "href",
        "/pricing",
      );
    });
  });

  describe("trialing (urgent - <= 3 days)", () => {
    it("shows urgent styling for 3 days or less", () => {
      useQueryMock.mockReturnValue({
        hasAccess: true,
        status: "trialing",
        daysRemaining: 3,
      });

      render(<TrialBanner />);

      expect(screen.getByText(/3 days left/)).toBeInTheDocument();
      expect(screen.getByText(/Subscribe now to keep your library/)).toBeInTheDocument();
    });

    it("does NOT have dismiss button when urgent", () => {
      useQueryMock.mockReturnValue({
        hasAccess: true,
        status: "trialing",
        daysRemaining: 2,
      });

      render(<TrialBanner />);

      expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
    });

    it("shows urgent styling for 0 days", () => {
      useQueryMock.mockReturnValue({
        hasAccess: true,
        status: "trialing",
        daysRemaining: 0,
      });

      render(<TrialBanner />);

      expect(screen.getByText(/0 days left/)).toBeInTheDocument();
    });
  });

  describe("trial expired", () => {
    it("shows trial expired message", () => {
      useQueryMock.mockReturnValue({
        hasAccess: false,
        reason: "trial_expired",
        status: "trialing",
      });

      render(<TrialBanner />);

      expect(screen.getByText(/Your trial has ended/)).toBeInTheDocument();
      expect(screen.getByText(/Subscribe to regain access/)).toBeInTheDocument();
    });

    it("has no dismiss button (non-dismissible)", () => {
      useQueryMock.mockReturnValue({
        hasAccess: false,
        reason: "trial_expired",
        status: "trialing",
      });

      render(<TrialBanner />);

      expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
    });

    it("cannot be dismissed even after re-render", () => {
      useQueryMock.mockReturnValue({
        hasAccess: false,
        reason: "trial_expired",
        status: "trialing",
      });

      const { rerender } = render(<TrialBanner />);

      // Re-render with same state
      rerender(<TrialBanner />);

      expect(screen.getByText(/Your trial has ended/)).toBeInTheDocument();
    });
  });

  describe("subscription expired", () => {
    it("shows subscription expired message", () => {
      useQueryMock.mockReturnValue({
        hasAccess: false,
        reason: "subscription_expired",
        status: "expired",
      });

      render(<TrialBanner />);

      expect(screen.getByText(/Your subscription has expired/)).toBeInTheDocument();
      expect(screen.getByText(/Subscribe to regain access/)).toBeInTheDocument();
    });

    it("has no dismiss button (non-dismissible)", () => {
      useQueryMock.mockReturnValue({
        hasAccess: false,
        reason: "subscription_expired",
        status: "expired",
      });

      render(<TrialBanner />);

      expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
    });
  });
});
