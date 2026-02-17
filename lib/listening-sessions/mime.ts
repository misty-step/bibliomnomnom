export const DEFAULT_AUDIO_MIME_TYPE = "audio/webm";

export function normalizeAudioMimeType(mimeType: string | null | undefined): string | undefined {
  if (!mimeType) return undefined;
  const base = mimeType.split(";")[0]?.trim();
  return base || undefined;
}

export function extensionForAudioMimeType(mimeType: string): string {
  const normalized = normalizeAudioMimeType(mimeType) ?? DEFAULT_AUDIO_MIME_TYPE;
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  return "webm";
}
