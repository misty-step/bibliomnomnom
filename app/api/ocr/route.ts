import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { log } from "@/lib/api/log";
import { withObservability } from "@/lib/api/withObservability";
import { DEFAULT_OCR_MODEL } from "@/lib/ai/models";
import { OpenRouterApiError, openRouterChatCompletion } from "@/lib/ai/openrouter";
import { MAX_BASE64_PAYLOAD_CHARS, MAX_DATA_URL_CHARS } from "@/lib/ocr/limits";
import { formatOcrText } from "@/lib/ocr/format";

const TIMEOUT_MS = 30000;

const EXTRACTION_PROMPT = `Extract all visible text from this book page photograph.

Return plain text only.

Formatting rules:
- Preserve paragraph breaks as blank lines between paragraphs.
- Do not insert line breaks for line wrapping; each paragraph should be reflowed into a single line.
- If a word is split across a line break with a hyphen, join it back into one word.

If no text is visible or readable, return an empty string.`;

type OCRRequest = {
  image: string;
};

function redactUserId(userId: string): string {
  if (!userId) return "";
  const suffixLen = 6;
  return userId.length <= suffixLen ? "…" : `…${userId.slice(-suffixLen)}`;
}

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
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const responseHeaders = { "x-request-id": requestId };
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in to use this feature", code: "UNAUTHORIZED" },
      { status: 401, headers: responseHeaders },
    );
  }

  log("info", "ocr_request", { requestId, user: redactUserId(userId) });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    log("error", "ocr_missing_api_key", { requestId });
    return NextResponse.json(
      { error: "OCR service not configured", code: "OCR_FAILED" },
      { status: 500, headers: responseHeaders },
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
        { status: 400, headers: responseHeaders },
      );
    }
    body = { image: (raw as { image: string }).image };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body", code: "INVALID_IMAGE" },
      { status: 400, headers: responseHeaders },
    );
  }

  // Quick guard before regex extraction; true size check happens on base64 payload below.
  if (body.image.length > MAX_DATA_URL_CHARS) {
    return NextResponse.json(
      { error: "Image is too large (max 5MB).", code: "INVALID_IMAGE" },
      { status: 413, headers: responseHeaders },
    );
  }

  const extracted = extractBase64(body.image);
  if (!extracted) {
    return NextResponse.json(
      { error: "Could not process image. Try a different photo.", code: "INVALID_IMAGE" },
      { status: 400, headers: responseHeaders },
    );
  }

  if (extracted.base64.length > MAX_BASE64_PAYLOAD_CHARS) {
    return NextResponse.json(
      { error: "Image is too large (max 5MB).", code: "INVALID_IMAGE" },
      { status: 413, headers: responseHeaders },
    );
  }

  const model =
    process.env.OPENROUTER_OCR_MODEL || process.env.OPENROUTER_MODEL || DEFAULT_OCR_MODEL;
  log("info", "ocr_model_selected", { requestId, model });

  try {
    const { content } = await openRouterChatCompletion({
      apiKey,
      timeoutMs: TIMEOUT_MS,
      referer: process.env.NEXT_PUBLIC_APP_URL || "https://bibliomnomnom.app",
      title: "bibliomnomnom",
      request: {
        model,
        max_tokens: 4096,
        temperature: 0.0,
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
      },
    });

    const rawText = content.trim();
    const text = formatOcrText(rawText);

    if (!text) {
      return NextResponse.json(
        { error: "No text found in image. Try a clearer photo.", code: "NO_TEXT" },
        { status: 200, headers: responseHeaders },
      );
    }

    log("info", "ocr_success", {
      requestId,
      rawChars: rawText.length,
      formattedChars: text.length,
    });
    return NextResponse.json({ text }, { headers: responseHeaders });
  } catch (error) {
    if (error instanceof OpenRouterApiError && error.status === 429) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment.", code: "RATE_LIMITED" },
        { status: 429, headers: responseHeaders },
      );
    }

    if (
      error instanceof OpenRouterApiError &&
      error.status === 400 &&
      error.providerMessage.toLowerCase().includes("not a valid model")
    ) {
      return NextResponse.json(
        {
          error:
            "OCR model misconfigured. Please set OPENROUTER_OCR_MODEL (or OPENROUTER_MODEL) to a valid model ID.",
          code: "OCR_MODEL_INVALID",
        },
        { status: 500, headers: responseHeaders },
      );
    }

    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Taking too long. Please try again.", code: "OCR_FAILED" },
        { status: 504, headers: responseHeaders },
      );
    }

    log("error", "ocr_unexpected_error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Could not read text. Please try again.", code: "OCR_FAILED" },
      { status: 500, headers: responseHeaders },
    );
  }
}, "ocr");
