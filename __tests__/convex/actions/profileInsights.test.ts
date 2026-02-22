import { describe, expect, it } from "vitest";
import {
  buildInsightsPrompt,
  fetchVoiceNoteSummariesSafe,
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
  it("should include voice note evidence section when summaries are provided", () => {
    // Arrange
    const prompt = buildInsightsPrompt(baseBooks, 2, [voiceNote]);
    // Act / Assert
    expect(prompt).toContain("VOICE NOTE EVIDENCE");
    expect(prompt).toContain("Dune");
    expect(prompt).toContain("Ecological allegory");
    expect(prompt).toContain("The spice melange mirrors our addiction to fossil fuels.");
  });

  it("should include artifact kind labels when voice notes are provided", () => {
    // Arrange
    const prompt = buildInsightsPrompt(baseBooks, 2, [voiceNote]);
    // Act / Assert
    expect(prompt).toContain("insight");
    expect(prompt).toContain("openQuestion");
  });

  it("should omit voice note evidence section when summaries are empty", () => {
    // Arrange
    const prompt = buildInsightsPrompt(baseBooks, 2, []);
    // Act / Assert
    expect(prompt).not.toContain("VOICE NOTE EVIDENCE");
  });

  it("should omit voice note evidence section when summaries are not provided", () => {
    // Arrange
    const prompt = buildInsightsPrompt(baseBooks, 2);
    // Act / Assert
    expect(prompt).not.toContain("VOICE NOTE EVIDENCE");
  });

  it("should include voice note guardrail when voice notes are provided", () => {
    // Arrange
    const prompt = buildInsightsPrompt(baseBooks, 2, [voiceNote]);
    // Act / Assert
    expect(prompt.toLowerCase()).toMatch(/only cite voice[- ]note/);
  });

  it("should omit voice note guardrail when no voice notes are provided", () => {
    // Arrange
    const promptWithout = buildInsightsPrompt(baseBooks, 2, []);
    // Act / Assert
    expect(promptWithout.toLowerCase()).not.toMatch(/only cite voice[- ]note/);
  });

  it("should truncate artifact content to 300 characters when content is long", () => {
    // Arrange
    const longContent = "x".repeat(400);
    const noteWithLongContent: VoiceNoteSummary = {
      bookTitle: "Dune",
      bookAuthor: "Frank Herbert",
      artifacts: [{ kind: "insight", title: "Long insight", content: longContent }],
    };
    // Act
    const prompt = buildInsightsPrompt(baseBooks, 2, [noteWithLongContent]);
    // Assert
    expect(prompt).toContain("x".repeat(300));
    expect(prompt).not.toContain("x".repeat(301));
  });

  it("should render multiple books' voice notes with separation when summaries span books", () => {
    // Arrange
    const multiBookNotes: VoiceNoteSummary[] = [
      {
        bookTitle: "Dune",
        bookAuthor: "Frank Herbert",
        artifacts: [{ kind: "insight", title: "Ecology", content: "Spice as oil allegory." }],
      },
      {
        bookTitle: "Foundation",
        bookAuthor: "Isaac Asimov",
        artifacts: [
          { kind: "quote", title: "Seldon quote", content: "Violence is the last refuge." },
        ],
      },
    ];
    // Act
    const prompt = buildInsightsPrompt(baseBooks, 2, multiBookNotes);
    // Assert
    expect(prompt).toContain('"Dune" by Frank Herbert');
    expect(prompt).toContain('"Foundation" by Isaac Asimov');
    expect(prompt).toContain("Spice as oil allegory.");
    expect(prompt).toContain("Violence is the last refuge.");
    expect(prompt).toContain("[quote]");
  });

  it("should render all five artifact kinds with correct labels", () => {
    // Arrange
    const allKinds: VoiceNoteSummary = {
      bookTitle: "Dune",
      bookAuthor: "Frank Herbert",
      artifacts: [
        { kind: "insight", title: "T1", content: "C1" },
        { kind: "openQuestion", title: "T2", content: "C2" },
        { kind: "quote", title: "T3", content: "C3" },
        { kind: "followUpQuestion", title: "T4", content: "C4" },
        { kind: "contextExpansion", title: "T5", content: "C5" },
      ],
    };
    // Act
    const prompt = buildInsightsPrompt(baseBooks, 2, [allKinds]);
    // Assert
    expect(prompt).toContain("[insight]");
    expect(prompt).toContain("[openQuestion]");
    expect(prompt).toContain("[quote]");
    expect(prompt).toContain("[followUpQuestion]");
    expect(prompt).toContain("[contextExpansion]");
  });
});

describe("fetchVoiceNoteSummariesSafe — graceful degradation", () => {
  it("should return empty array when fetcher throws", async () => {
    // Arrange
    const profileId = "profile_1";
    const fetcher = () => Promise.reject(new Error("DB unavailable"));
    // Act
    const result = await fetchVoiceNoteSummariesSafe(fetcher, profileId);
    // Assert
    expect(result).toEqual([]);
  });

  it("should return summaries when fetcher resolves", async () => {
    // Arrange
    const profileId = "profile_1";
    const summaries: VoiceNoteSummary[] = [
      {
        bookTitle: "Dune",
        bookAuthor: "Frank Herbert",
        artifacts: [{ kind: "insight", title: "Ecology", content: "Spice allegory." }],
      },
    ];
    const fetcher = () => Promise.resolve(summaries);
    // Act
    const result = await fetchVoiceNoteSummariesSafe(fetcher, profileId);
    // Assert
    expect(result).toEqual(summaries);
  });
});

describe("parseInsightsResponse — no regression with voice note additions", () => {
  it("should parse minimal response when JSON is valid", () => {
    // Arrange
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
    // Act
    const result = parseInsightsResponse(response, 25);
    // Assert
    expect(result.tasteTagline).toBe("A reader of speculative futures");
    expect(result.confidence).toBe("developing");
    expect(result.recommendations?.goDeeper).toHaveLength(1);
    expect(result.recommendations?.goDeeper[0]!.title).toBe("Hyperion");
  });

  it("should fall back gracefully when response is malformed", () => {
    // Act
    const result = parseInsightsResponse("not json at all", 25);
    // Assert
    expect(result.tasteTagline).toBe("A reader with eclectic and diverse tastes");
    expect(result.literaryTaste.genres).toEqual([]);
    expect(result.confidence).toBe("developing");
  });
});
