import { describe, expect, it } from "vitest";
import { makeFallbackArtifacts } from "@/lib/listening-sessions/fallback-artifacts";
import type { SynthesisContext } from "@/lib/listening-sessions/synthesis";

describe("makeFallbackArtifacts", () => {
  it("extracts sentence-based insights from transcript", () => {
    const result = makeFallbackArtifacts("First point. Second point. Third point.");
    expect(result.insights).toHaveLength(3);
    expect(result.insights[0]!.title).toBe("Session insight 1");
    expect(result.insights[0]!.content).toBe("First point.");
  });

  it("caps insights at 3", () => {
    const result = makeFallbackArtifacts("One. Two. Three. Four. Five.");
    expect(result.insights.length).toBeLessThanOrEqual(3);
  });

  it("extracts questions as openQuestions", () => {
    const result = makeFallbackArtifacts("Statement. Is this a question? Another one?");
    expect(result.openQuestions).toEqual(["Is this a question?", "Another one?"]);
  });

  it("caps openQuestions at 4", () => {
    const result = makeFallbackArtifacts("Q1? Q2? Q3? Q4? Q5? Q6?");
    expect(result.openQuestions.length).toBeLessThanOrEqual(4);
  });

  it("extracts quoted text between straight quotes", () => {
    const result = makeFallbackArtifacts(
      'She said "the world is vast and full of wonder" and then left.',
    );
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]!.text).toBe("the world is vast and full of wonder");
  });

  it("skips quotes shorter than 12 chars", () => {
    const result = makeFallbackArtifacts('He said "short" to her.');
    expect(result.quotes).toHaveLength(0);
  });

  it("provides default followUpQuestion without context", () => {
    const result = makeFallbackArtifacts("Some transcript.");
    expect(result.followUpQuestions).toHaveLength(1);
    expect(result.followUpQuestions[0]).toContain("revisit next reading block");
  });

  it("provides context-aware followUpQuestion when book title present", () => {
    const context: SynthesisContext = {
      book: { title: "Moby Dick", author: "Melville" },
      currentlyReading: [],
      wantToRead: [],
      read: [],
      recentNotes: [],
    };
    const result = makeFallbackArtifacts("Some transcript.", context);
    expect(result.followUpQuestions[0]).toContain("Moby Dick");
  });

  it("generates contextExpansions when book has title and author", () => {
    const context: SynthesisContext = {
      book: { title: "Moby Dick", author: "Melville" },
      currentlyReading: [],
      wantToRead: [],
      read: [],
      recentNotes: [],
    };
    const result = makeFallbackArtifacts("Some transcript.", context);
    expect(result.contextExpansions).toHaveLength(1);
    expect(result.contextExpansions[0]!.title).toContain("Moby Dick");
    expect(result.contextExpansions[0]!.content).toContain("Melville");
  });

  it("returns empty contextExpansions when no book context", () => {
    const result = makeFallbackArtifacts("Some transcript.");
    expect(result.contextExpansions).toEqual([]);
  });

  it("returns empty arrays for empty transcript", () => {
    const result = makeFallbackArtifacts("");
    expect(result.insights).toEqual([]);
    expect(result.openQuestions).toEqual([]);
    expect(result.quotes).toEqual([]);
  });

  it("handles whitespace-only transcript", () => {
    const result = makeFallbackArtifacts("   \n\t  ");
    expect(result.insights).toEqual([]);
    expect(result.openQuestions).toEqual([]);
  });

  it("collapses multiple whitespace into single spaces", () => {
    const result = makeFallbackArtifacts("First   point.\n\nSecond   point.");
    expect(result.insights[0]!.content).toBe("First point.");
    expect(result.insights[1]!.content).toBe("Second point.");
  });
});
