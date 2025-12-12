import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { withObservability } from "@/lib/api/withObservability";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash-preview";
const TIMEOUT_MS = 30000;

// 5MB limit - base64 expands by ~4/3, plus data URL prefix overhead
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES * (4 / 3)) + 1024;

const EXTRACTION_PROMPT = `Extract all visible text from this book page photograph.
Return only the extracted text, preserving paragraph breaks.
Do not add any commentary, formatting, or interpretation—just the raw text as it appears.
If no text is visible or readable, return an empty string.`;

type OCRRequest = {
  image: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message: string;
    code?: string;
  };
};

function extractBase64(dataUrl: string): { base64: string; mediaType: string } | null {
  // Require data URL format with explicit media type (e.g., data:image/jpeg;base64,/9j/4AAQ...)
  // Supports standard types (image/jpeg, image/png) and extended types (image/svg+xml, image/vnd.*)
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { mediaType: match[1]!, base64: match[2]! };
  }
  return null;
}

export const POST = withObservability(async (request: Request) => {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in to use this feature", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[ocr] OPENROUTER_API_KEY not configured");
    return NextResponse.json(
      { error: "OCR service not configured", code: "OCR_FAILED" },
      { status: 500 },
    );
  }

  let body: OCRRequest;
  try {
    const raw: unknown = await request.json();
    // Runtime validation - don't trust the cast
    if (
      typeof raw !== "object" ||
      raw === null ||
      !("image" in raw) ||
      typeof (raw as { image: unknown }).image !== "string" ||
      (raw as { image: string }).image.length === 0
    ) {
      return NextResponse.json(
        { error: "Request body must include a non-empty image string", code: "INVALID_IMAGE" },
        { status: 400 },
      );
    }
    body = { image: (raw as { image: string }).image };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body", code: "INVALID_IMAGE" },
      { status: 400 },
    );
  }

  // Enforce 5MB size limit before processing
  if (body.image.length > MAX_BASE64_CHARS) {
    return NextResponse.json(
      { error: "Image is too large (max 5MB).", code: "INVALID_IMAGE" },
      { status: 413 },
    );
  }

  const extracted = extractBase64(body.image);
  if (!extracted) {
    return NextResponse.json(
      { error: "Could not process image. Try a different photo.", code: "INVALID_IMAGE" },
      { status: 400 },
    );
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://bibliomnomnom.app",
        "X-Title": "bibliomnomnom",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${extracted.mediaType};base64,${extracted.base64}`,
                },
              },
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as OpenRouterResponse;
      console.error("[ocr] OpenRouter error:", response.status, errorData);

      if (response.status === 429) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment.", code: "RATE_LIMITED" },
          { status: 429 },
        );
      }

      return NextResponse.json(
        { error: "Could not read text. Please try again.", code: "OCR_FAILED" },
        { status: 500 },
      );
    }

    const data = (await response.json()) as OpenRouterResponse;
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      return NextResponse.json(
        { error: "No text found in image. Try a clearer photo.", code: "NO_TEXT" },
        { status: 200 },
      );
    }

    console.log(`[ocr] Extracted ${text.length} characters`);
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Taking too long. Please try again.", code: "OCR_FAILED" },
        { status: 504 },
      );
    }

    console.error("[ocr] Unexpected error:", error);
    return NextResponse.json(
      { error: "Could not read text. Please try again.", code: "OCR_FAILED" },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}, "ocr");
