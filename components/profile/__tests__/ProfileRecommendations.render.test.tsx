import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileRecommendations } from "../ProfileRecommendations";

vi.mock("../ProfileBookCover", () => ({
  ProfileBookCover: ({ title }: { title: string }) => <div data-testid="mock-cover">{title}</div>,
}));

const recommendations = {
  goDeeper: [
    { title: "Deeper 1", author: "Author D1", reason: "Reason D1" },
    { title: "Deeper 2", author: "Author D2", reason: "Reason D2" },
  ],
  goWider: [
    { title: "Wider 1", author: "Author W1", reason: "Reason W1" },
    { title: "Wider 2", author: "Author W2", reason: "Reason W2" },
  ],
};

describe("ProfileRecommendations compact mode", () => {
  it("should render compact view with top recommendations when maxItems is set", () => {
    render(<ProfileRecommendations recommendations={recommendations} maxItems={3} />);

    expect(screen.getByText("What should I read next?")).toBeInTheDocument();
    expect(screen.getByText("Deeper 1")).toBeInTheDocument();
    expect(screen.getByText("Wider 1")).toBeInTheDocument();
    expect(screen.getByText("Deeper 2")).toBeInTheDocument();
    expect(screen.queryByText("Wider 2")).toBeNull();
  });

  it("should toggle to full view when See All is clicked and back when Show Top is clicked", () => {
    render(<ProfileRecommendations recommendations={recommendations} maxItems={3} />);

    fireEvent.click(screen.getByRole("button", { name: "See All" }));
    expect(screen.getByText("What to Read Next")).toBeInTheDocument();
    expect(screen.getByText("Wider 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show Top 3" }));
    expect(screen.getByText("What should I read next?")).toBeInTheDocument();
    expect(screen.queryByText("Wider 2")).toBeNull();
  });

  it("should invoke refresh callback and disable refresh button when refreshing", () => {
    const onRefresh = vi.fn();

    const { rerender } = render(
      <ProfileRecommendations
        recommendations={recommendations}
        maxItems={3}
        onRefreshRecommendations={onRefresh}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh Suggestions" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <ProfileRecommendations
        recommendations={recommendations}
        maxItems={3}
        onRefreshRecommendations={onRefresh}
        isRefreshing
      />,
    );

    expect(screen.getByRole("button", { name: "Refresh Suggestions" })).toBeDisabled();
  });
});
