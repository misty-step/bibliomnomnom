import { describe, expect, it } from "vitest";
import {
  clampArtifacts,
  normalizeArtifacts,
  EMPTY_SYNTHESIS_ARTIFACTS,
  type SynthesisArtifacts,
} from "@/lib/listening-sessions/synthesis";

describe("listening sessions synthesis helpers", () => {
  it("clamps arrays and trims/slices strings", () => {
    const artifacts: SynthesisArtifacts = {
      insights: Array.from({ length: 12 }, (_v, i) => ({
        title: `  Title ${i}  `,
        content: `  Content ${i}  `,
      })),
      openQuestions: Array.from({ length: 12 }, (_v, i) => `  Open ${i}  `),
      quotes: Array.from({ length: 12 }, (_v, i) => ({
        text: `  Quote ${i}  `,
        source: `  Source ${i}  `,
      })),
      followUpQuestions: Array.from({ length: 12 }, (_v, i) => `  Follow ${i}  `),
      contextExpansions: Array.from({ length: 12 }, (_v, i) => ({
        title: `  Context ${i}  `,
        content: `  Body ${i}  `,
      })),
    };

    const clamped = clampArtifacts(artifacts);
    expect(clamped.insights).toHaveLength(6);
    expect(clamped.openQuestions).toHaveLength(6);
    expect(clamped.quotes).toHaveLength(6);
    expect(clamped.followUpQuestions).toHaveLength(6);
    expect(clamped.contextExpansions).toHaveLength(6);

    expect(clamped.insights[0]?.title).toBe("Title 0");
    expect(clamped.insights[0]?.content).toBe("Content 0");
    expect(clamped.quotes[0]?.text).toBe("Quote 0");
    expect(clamped.quotes[0]?.source).toBe("Source 0");
  });
});

describe("normalizeArtifacts", () => {
  it("returns empty artifacts for null", () => {
    expect(normalizeArtifacts(null)).toEqual(EMPTY_SYNTHESIS_ARTIFACTS);
  });

  it("returns empty artifacts for non-object primitives", () => {
    expect(normalizeArtifacts("string")).toEqual(EMPTY_SYNTHESIS_ARTIFACTS);
    expect(normalizeArtifacts(42)).toEqual(EMPTY_SYNTHESIS_ARTIFACTS);
    expect(normalizeArtifacts(undefined)).toEqual(EMPTY_SYNTHESIS_ARTIFACTS);
  });

  it("normalizes a well-formed object", () => {
    const raw = {
      insights: [{ title: "Idea", content: "The content" }],
      openQuestions: ["What next?"],
      quotes: [{ text: "A quote", source: "Chapter 1" }],
      followUpQuestions: ["Re-read chapter 2"],
      contextExpansions: [{ title: "Topic", content: "Background" }],
    };
    const result = normalizeArtifacts(raw);
    expect(result.insights).toEqual([{ title: "Idea", content: "The content" }]);
    expect(result.openQuestions).toEqual(["What next?"]);
    expect(result.quotes).toEqual([{ text: "A quote", source: "Chapter 1" }]);
    expect(result.followUpQuestions).toEqual(["Re-read chapter 2"]);
    expect(result.contextExpansions).toEqual([{ title: "Topic", content: "Background" }]);
  });

  it("filters insights missing title or content", () => {
    const raw = {
      insights: [
        { title: "Good", content: "Valid" },
        { title: "Missing content" },
        { content: "Missing title" },
        "not an object",
        null,
      ],
      openQuestions: [],
      quotes: [],
      followUpQuestions: [],
      contextExpansions: [],
    };
    const result = normalizeArtifacts(raw);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0]?.title).toBe("Good");
  });

  it("filters non-string items from openQuestions and followUpQuestions", () => {
    const raw = {
      insights: [],
      openQuestions: ["valid", 42, null, "also valid"],
      quotes: [],
      followUpQuestions: [true, "valid follow-up"],
      contextExpansions: [],
    };
    const result = normalizeArtifacts(raw);
    expect(result.openQuestions).toEqual(["valid", "also valid"]);
    expect(result.followUpQuestions).toEqual(["valid follow-up"]);
  });

  it("handles non-array fields gracefully", () => {
    const raw = {
      insights: "not an array",
      openQuestions: 42,
      quotes: null,
      followUpQuestions: {},
      contextExpansions: false,
    };
    const result = normalizeArtifacts(raw);
    expect(result.insights).toEqual([]);
    expect(result.openQuestions).toEqual([]);
    expect(result.quotes).toEqual([]);
    expect(result.followUpQuestions).toEqual([]);
    expect(result.contextExpansions).toEqual([]);
  });

  it("filters quotes missing text and handles optional source", () => {
    const raw = {
      insights: [],
      openQuestions: [],
      quotes: [
        { text: "Valid quote", source: "Page 1" },
        { text: "No source" },
        { source: "Missing text" },
        { text: "Non-string source", source: 42 },
      ],
      followUpQuestions: [],
      contextExpansions: [],
    };
    const result = normalizeArtifacts(raw);
    expect(result.quotes).toHaveLength(3);
    expect(result.quotes[0]).toEqual({ text: "Valid quote", source: "Page 1" });
    expect(result.quotes[1]).toEqual({ text: "No source", source: undefined });
    expect(result.quotes[2]).toEqual({ text: "Non-string source", source: undefined });
  });

  it("filters contextExpansions missing title or content", () => {
    const raw = {
      insights: [],
      openQuestions: [],
      quotes: [],
      followUpQuestions: [],
      contextExpansions: [
        { title: "Valid", content: "Good" },
        { title: "Missing content" },
        "not an object",
      ],
    };
    const result = normalizeArtifacts(raw);
    expect(result.contextExpansions).toHaveLength(1);
    expect(result.contextExpansions[0]?.title).toBe("Valid");
  });

  it("delegates to clampArtifacts (respects limits)", () => {
    const raw = {
      insights: Array.from({ length: 20 }, (_, i) => ({ title: `T${i}`, content: `C${i}` })),
      openQuestions: Array.from({ length: 20 }, (_, i) => `Q${i}`),
      quotes: Array.from({ length: 20 }, (_, i) => ({ text: `Quote ${i}` })),
      followUpQuestions: Array.from({ length: 20 }, (_, i) => `F${i}`),
      contextExpansions: Array.from({ length: 20 }, (_, i) => ({
        title: `T${i}`,
        content: `C${i}`,
      })),
    };
    const result = normalizeArtifacts(raw);
    expect(result.insights).toHaveLength(6);
    expect(result.openQuestions).toHaveLength(6);
    expect(result.quotes).toHaveLength(6);
    expect(result.followUpQuestions).toHaveLength(6);
    expect(result.contextExpansions).toHaveLength(6);
  });
});
