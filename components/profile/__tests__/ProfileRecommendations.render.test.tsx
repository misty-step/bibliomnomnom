import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProfileRecommendations } from "../ProfileRecommendations";

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

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
    // Arrange
    render(<ProfileRecommendations recommendations={recommendations} maxItems={3} />);

    // Assert
    expect(screen.getByText("What should I read next?")).toBeInTheDocument();
    expect(screen.getAllByText("Deeper 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wider 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Deeper 2").length).toBeGreaterThan(0);
    expect(screen.queryByText("Wider 2")).toBeNull();
  });

  it("should show full view when See All is clicked", () => {
    // Arrange
    render(<ProfileRecommendations recommendations={recommendations} maxItems={3} />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "See All" }));

    // Assert
    expect(screen.getByText("What to Read Next")).toBeInTheDocument();
    expect(screen.getAllByText("Wider 2").length).toBeGreaterThan(0);
  });

  it("should return to compact view when Show Top 3 is clicked", () => {
    // Arrange
    render(<ProfileRecommendations recommendations={recommendations} maxItems={3} />);
    fireEvent.click(screen.getByRole("button", { name: "See All" }));

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Show Top 3" }));

    // Assert
    expect(screen.getByText("What should I read next?")).toBeInTheDocument();
    expect(screen.queryByText("Wider 2")).toBeNull();
  });

  it("should invoke refresh callback when refresh button is clicked", () => {
    // Arrange
    const onRefresh = vi.fn();

    render(
      <ProfileRecommendations
        recommendations={recommendations}
        maxItems={3}
        onRefreshRecommendations={onRefresh}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Refresh Suggestions" }));

    // Assert
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("should disable refresh button when isRefreshing is true", () => {
    // Arrange
    const onRefresh = vi.fn();
    render(
      <ProfileRecommendations
        recommendations={recommendations}
        maxItems={3}
        onRefreshRecommendations={onRefresh}
        isRefreshing
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Refresh Suggestions" })).toBeDisabled();
  });

  it("should normalize badge labels when kebab-case badges are provided", () => {
    // Arrange
    render(
      <ProfileRecommendations
        recommendations={{
          goDeeper: [
            {
              title: "Badge Book",
              author: "Badge Author",
              reason: "Badge Reason",
              badges: ["foundational-read", "Foundational Read", "historical cornerstone"],
            },
          ],
          goWider: [],
        }}
      />,
    );

    // Act
    // Render only.

    // Assert
    expect(screen.getByText("Foundational Read")).toBeInTheDocument();
    expect(screen.getByText("historical cornerstone")).toBeInTheDocument();
  });

  it("should dedupe badge labels when normalized values collide", () => {
    // Arrange
    render(
      <ProfileRecommendations
        recommendations={{
          goDeeper: [
            {
              title: "Badge Book",
              author: "Badge Author",
              reason: "Badge Reason",
              badges: ["Foundational Read", "foundational read", "FOUNDATIONAL-READ"],
            },
          ],
          goWider: [],
        }}
      />,
    );

    // Act
    // Render only.

    // Assert
    expect(screen.getAllByText("Foundational Read")).toHaveLength(1);
  });
});
