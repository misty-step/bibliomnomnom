import { describe, expect, it } from "vitest";
import { buildListeningSynthesisPrompt } from "@/lib/listening-sessions/synthesisPrompt";
import type { SynthesisContext } from "@/lib/listening-sessions/synthesis";

describe("listening sessions synthesis prompt", () => {
  it("renders a prompt without context", () => {
    const prompt = buildListeningSynthesisPrompt({ transcript: "Hello world." });
    expect(prompt).toContain("Rules:");
    expect(prompt).toContain("Output:");
    expect(prompt).toContain("Transcript:");
    expect(prompt).toContain("Hello world.");
    expect(prompt).not.toContain("Reading context:");
  });

  it("renders a prompt with context and truncates lists", () => {
    const context: SynthesisContext = {
      book: { title: "The Book", author: "Author", description: "A description." },
      currentlyReading: Array.from({ length: 12 }, (_v, i) => ({ title: `CR ${i}`, author: "" })),
      wantToRead: Array.from({ length: 12 }, (_v, i) => ({ title: `WTR ${i}`, author: "" })),
      read: Array.from({ length: 40 }, (_v, i) => ({ title: `READ ${i}`, author: "" })),
      recentNotes: Array.from({ length: 20 }, (_v, i) => ({
        bookTitle: `NoteBook ${i}`,
        type: i % 2 === 0 ? "note" : "quote",
        content: `Note ${i}`,
      })),
    };

    const prompt = buildListeningSynthesisPrompt({
      transcript: "A messy thought.",
      context,
    });

    expect(prompt).toContain("Reading context:");
    expect(prompt).toContain("Book: The Book (Author)");
    expect(prompt).toContain("Description: A description.");
    expect(prompt).toContain("Currently reading:");
    expect(prompt).toContain("Want to read:");
    expect(prompt).toContain("Read:");
    expect(prompt).toContain("Recent notes");

    expect(prompt).toContain("- CR 0");
    expect(prompt).not.toContain("- CR 11");

    expect(prompt).toContain("- WTR 0");
    expect(prompt).not.toContain("- WTR 11");

    expect(prompt).toContain("- READ 0");
    expect(prompt).not.toContain("- READ 39");

    expect(prompt).toContain("- [NoteBook 0]");
    expect(prompt).not.toContain("- [NoteBook 19]");
  });
});
