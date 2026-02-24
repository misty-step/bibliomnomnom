import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookRecommendation } from "../BookRecommendation";

describe("BookRecommendation badges", () => {
  it("should normalize, dedupe, and cap dynamic badges", () => {
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

    // Assert
    expect(screen.getByText("Foundational Read")).toBeInTheDocument();
    expect(screen.getByText("historical cornerstone")).toBeInTheDocument();
    expect(screen.getAllByText("Foundational Read")).toHaveLength(1);
    expect(screen.queryByText("third badge")).toBeNull();
  });
});
