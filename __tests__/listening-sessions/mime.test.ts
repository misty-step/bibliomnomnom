import { describe, expect, it } from "vitest";
import { extensionForAudioMimeType, normalizeAudioMimeType } from "@/lib/listening-sessions/mime";

describe("listening sessions mime helpers", () => {
  it("normalizes mime types to their base type", () => {
    expect(normalizeAudioMimeType(null)).toBeUndefined();
    expect(normalizeAudioMimeType(undefined)).toBeUndefined();
    expect(normalizeAudioMimeType("")).toBeUndefined();
    expect(normalizeAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMimeType(" audio/ogg ; codecs=opus ")).toBe("audio/ogg");
  });

  it("maps mime types to file extensions", () => {
    expect(extensionForAudioMimeType("audio/webm")).toBe("webm");
    expect(extensionForAudioMimeType("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForAudioMimeType("audio/mpeg")).toBe("mp3");
    expect(extensionForAudioMimeType("audio/mp4")).toBe("m4a");
    expect(extensionForAudioMimeType("audio/x-m4a")).toBe("m4a");
    expect(extensionForAudioMimeType("audio/ogg")).toBe("ogg");
    expect(extensionForAudioMimeType("audio/wav")).toBe("wav");
    expect(extensionForAudioMimeType("audio/x-wav")).toBe("wav");
  });
});
