import { describe, expect, it } from "vitest";
import { clampArtifacts, type SynthesisArtifacts } from "@/lib/listening-sessions/synthesis";

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
    expect(clamped.insights).toHaveLength(8);
    expect(clamped.openQuestions).toHaveLength(8);
    expect(clamped.quotes).toHaveLength(8);
    expect(clamped.followUpQuestions).toHaveLength(8);
    expect(clamped.contextExpansions).toHaveLength(6);

    expect(clamped.insights[0]?.title).toBe("Title 0");
    expect(clamped.insights[0]?.content).toBe("Content 0");
    expect(clamped.quotes[0]?.text).toBe("Quote 0");
    expect(clamped.quotes[0]?.source).toBe("Source 0");
  });
});
