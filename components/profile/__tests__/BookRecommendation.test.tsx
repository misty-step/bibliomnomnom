import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookRecommendation } from "../BookRecommendation";

describe("BookRecommendation badges", () => {
  it("should normalize badge text when spacing and casing vary", () => {
    // Arrange
    render(
      <BookRecommendation
        title="Badge Book"
        author="Badge Author"
        reason="Badge Reason"
        badges={[
          "foundational-read",
          "  Foundational   Read  ",
          "historical cornerstone",
          "third badge",
        ]}
      />,
    );

    // Act
    // Render only.

    // Assert
    expect(screen.getByText("Foundational Read")).toBeInTheDocument();
  });

  it("should dedupe badges when labels normalize to the same value", () => {
    // Arrange
    render(
      <BookRecommendation
        title="Badge Book"
        author="Badge Author"
        reason="Badge Reason"
        badges={["foundational-read", "  Foundational   Read  ", "historical cornerstone"]}
      />,
    );

    // Act
    // Render only.

    // Assert
    expect(screen.getByText("historical cornerstone")).toBeInTheDocument();
    expect(screen.getAllByText("Foundational Read")).toHaveLength(1);
  });

  it("should cap dynamic badges when more than two badges are provided", () => {
    // Arrange
    render(
      <BookRecommendation
        title="Badge Book"
        author="Badge Author"
        reason="Badge Reason"
        badges={[
          "foundational-read",
          "  Foundational   Read  ",
          "historical cornerstone",
          "third badge",
        ]}
      />,
    );

    // Act
    // Render only.

    // Assert
    expect(screen.queryByText("third badge")).toBeNull();
  });
});
