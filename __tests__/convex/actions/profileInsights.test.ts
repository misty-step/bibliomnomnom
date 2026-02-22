import { describe, expect, it } from "vitest";
import {
  buildInsightsPrompt,
  parseInsightsResponse,
  type VoiceNoteSummary,
} from "../../../convex/actions/profileInsights";

type BookSummary = Parameters<typeof buildInsightsPrompt>[0][number];

const baseBooks: BookSummary[] = [
  {
    title: "Dune",
    author: "Frank Herbert",
    status: "read",
    isFavorite: true,
    isAudiobook: false,
    timesRead: 1,
  },
  {
    title: "Foundation",
    author: "Isaac Asimov",
    status: "read",
    isFavorite: false,
    isAudiobook: false,
    timesRead: 1,
  },
];

const voiceNote: VoiceNoteSummary = {
  bookTitle: "Dune",
  bookAuthor: "Frank Herbert",
  artifacts: [
    {
      kind: "insight",
      title: "Ecological allegory",
      content: "The spice melange mirrors our addiction to fossil fuels.",
    },
    {
      kind: "openQuestion",
      title: "Prescience burden",
      content: "Does Paul's prescience make his choices more or less free?",
    },
  ],
};

describe("buildInsightsPrompt — voice note evidence", () => {
  it("includes VOICE NOTE EVIDENCE section when summaries provided", () => {
    const prompt = buildInsightsPrompt(baseBooks, 2, [voiceNote]);
    expect(prompt).toContain("VOICE NOTE EVIDENCE");
    expect(prompt).toContain("Dune");
    expect(prompt).toContain("Ecological allegory");
    expect(prompt).toContain("The spice melange mirrors our addiction to fossil fuels.");
  });

  it("includes artifact kind labels in voice note section", () => {
    const prompt = buildInsightsPrompt(baseBooks, 2, [voiceNote]);
    expect(prompt).toContain("insight");
    expect(prompt).toContain("openQuestion");
  });

  it("omits VOICE NOTE EVIDENCE section when summaries is empty", () => {
    const prompt = buildInsightsPrompt(baseBooks, 2, []);
    expect(prompt).not.toContain("VOICE NOTE EVIDENCE");
  });

  it("omits VOICE NOTE EVIDENCE section when summaries is not provided", () => {
    const prompt = buildInsightsPrompt(baseBooks, 2);
    expect(prompt).not.toContain("VOICE NOTE EVIDENCE");
  });

  it("includes guardrail against hallucinating voice evidence", () => {
    const prompt = buildInsightsPrompt(baseBooks, 2, [voiceNote]);
    // Should contain some form of "only cite" voice note evidence that is present
    expect(prompt.toLowerCase()).toMatch(/only cite voice[- ]note/);
  });

  it("should omit guardrail when no voice notes provided", () => {
    // Guardrail should only appear when voice notes are present
    const promptWithVoiceNotes = buildInsightsPrompt(baseBooks, 2, [voiceNote]);
    const promptWithout = buildInsightsPrompt(baseBooks, 2, []);
    // When voice notes are present, the guardrail should appear
    expect(promptWithVoiceNotes.toLowerCase()).toMatch(/only cite voice[- ]note/);
    // When no voice notes, no guardrail needed
    expect(promptWithout.toLowerCase()).not.toMatch(/only cite voice[- ]note/);
  });
});

describe("parseInsightsResponse — no regression with voice note additions", () => {
  it("parses minimal valid response", () => {
    const response = JSON.stringify({
      tasteTagline: "A reader of speculative futures",
      literaryTaste: {
        genres: ["science fiction"],
        moods: ["contemplative"],
        complexity: "moderate",
      },
      thematicConnections: [],
      recommendations: {
        goDeeper: [
          {
            title: "Hyperion",
            author: "Dan Simmons",
            reason: "Continues the epic sci-fi thread",
            connectionBooks: ["Dune"],
            badges: ["award-winner"],
          },
        ],
        goWider: [],
      },
    });

    const result = parseInsightsResponse(response, 25);
    expect(result.tasteTagline).toBe("A reader of speculative futures");
    expect(result.confidence).toBe("developing");
    expect(result.recommendations?.goDeeper).toHaveLength(1);
    expect(result.recommendations?.goDeeper[0]!.title).toBe("Hyperion");
  });

  it("falls back gracefully on malformed response", () => {
    const result = parseInsightsResponse("not json at all", 25);
    expect(result.tasteTagline).toBe("A reader with eclectic and diverse tastes");
    expect(result.literaryTaste.genres).toEqual([]);
    expect(result.confidence).toBe("developing");
  });
});
