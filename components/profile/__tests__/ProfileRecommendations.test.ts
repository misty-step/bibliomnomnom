import { describe, expect, it } from "vitest";
import { getTopRecommendations } from "../ProfileRecommendations";

type Recommendation = {
  title: string;
  author: string;
  reason: string;
};

function rec(id: string): Recommendation {
  return {
    title: `Title ${id}`,
    author: `Author ${id}`,
    reason: `Reason ${id}`,
  };
}

describe("getTopRecommendations", () => {
  it("should interleave deeper and wider recommendations when both lists have items", () => {
    const result = getTopRecommendations(
      {
        goDeeper: [rec("D1"), rec("D2"), rec("D3")],
        goWider: [rec("W1"), rec("W2"), rec("W3")],
      },
      5,
    );

    expect(result.map((item) => item.title)).toEqual([
      "Title D1",
      "Title W1",
      "Title D2",
      "Title W2",
      "Title D3",
    ]);
  });

  it("should truncate output to maxItems when interleaving produces more items", () => {
    const result = getTopRecommendations(
      {
        goDeeper: [rec("D1"), rec("D2"), rec("D3")],
        goWider: [rec("W1"), rec("W2"), rec("W3")],
      },
      3,
    );

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.title)).toEqual(["Title D1", "Title W1", "Title D2"]);
  });

  it("should return only deeper recommendations when wider list is empty", () => {
    const result = getTopRecommendations(
      {
        goDeeper: [rec("D1"), rec("D2")],
        goWider: [],
      },
      3,
    );

    expect(result.map((item) => item.title)).toEqual(["Title D1", "Title D2"]);
  });

  it("should continue with remaining wider recommendations when deeper list is shorter", () => {
    const result = getTopRecommendations(
      {
        goDeeper: [rec("D1")],
        goWider: [rec("W1"), rec("W2"), rec("W3")],
      },
      4,
    );

    expect(result.map((item) => item.title)).toEqual([
      "Title D1",
      "Title W1",
      "Title W2",
      "Title W3",
    ]);
  });
});
