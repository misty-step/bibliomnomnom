import { describe, expect, it } from "vitest";
import {
  EMPTY_SYNTHESIS_ARTIFACTS,
  clampArtifacts,
  normalizeArtifacts,
  type SynthesisArtifacts,
} from "@/lib/listening-sessions/synthesis";

describe("synthesis partial-failure behavior", () => {
  it("clampArtifacts trims insights beyond MAX_SYNTH_ARTIFACT_ITEMS (6)", () => {
    const artifacts: SynthesisArtifacts = {
      insights: Array.from({ length: 10 }, (_, i) => ({ title: `Insight ${i}`, content: "body" })),
      openQuestions: [],
      quotes: [],
      followUpQuestions: [],
      contextExpansions: [],
    };

    const clamped = clampArtifacts(artifacts);
    expect(clamped.insights.length).toBeLessThanOrEqual(6);
  });

  it("clampArtifacts trims quotes beyond MAX_SYNTH_ARTIFACT_ITEMS", () => {
    const artifacts: SynthesisArtifacts = {
      insights: [],
      openQuestions: [],
      quotes: Array.from({ length: 10 }, (_, i) => ({ text: `Quote ${i}`, source: "src" })),
      followUpQuestions: [],
      contextExpansions: [],
    };

    const clamped = clampArtifacts(artifacts);
    expect(clamped.quotes.length).toBeLessThanOrEqual(6);
  });

  it("normalizeArtifacts handles null/undefined gracefully", () => {
    expect(normalizeArtifacts(null)).toEqual(EMPTY_SYNTHESIS_ARTIFACTS);
    expect(normalizeArtifacts(undefined)).toEqual(EMPTY_SYNTHESIS_ARTIFACTS);
  });

  it("normalizeArtifacts handles missing fields", () => {
    const result = normalizeArtifacts({
      insights: [{ title: "One", content: "One body" }],
    });

    expect(result).toEqual({
      insights: [{ title: "One", content: "One body" }],
      openQuestions: [],
      quotes: [],
      followUpQuestions: [],
      contextExpansions: [],
    });
  });

  it("EMPTY_SYNTHESIS_ARTIFACTS has all required keys", () => {
    expect(EMPTY_SYNTHESIS_ARTIFACTS).toEqual({
      insights: [],
      openQuestions: [],
      quotes: [],
      followUpQuestions: [],
      contextExpansions: [],
    });
  });
});
