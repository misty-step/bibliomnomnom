const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterRole = "system" | "user" | "assistant" | "tool";

export type OpenRouterMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  // Keep door open for other OpenAI-compatible parts.
  | { type: string; [key: string]: unknown };

export type OpenRouterChatMessage = {
  role: OpenRouterRole;
  content: string | OpenRouterMessageContentPart[];
};

export type OpenRouterJsonSchema = {
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
};

export type OpenRouterResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: OpenRouterJsonSchema };

export type OpenRouterChatCompletionRequest = {
  model: string;
  messages: OpenRouterChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: OpenRouterResponseFormat;
};

type OpenRouterChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message: string;
    code?: string | number;
  };
};

export class OpenRouterApiError extends Error {
  readonly status: number;
  readonly providerMessage: string;

  constructor(params: { status: number; providerMessage: string }) {
    super(`OpenRouter error: ${params.status} ${params.providerMessage}`);
    this.name = "OpenRouterApiError";
    this.status = params.status;
    this.providerMessage = params.providerMessage;
  }
}

export async function openRouterChatCompletion(params: {
  apiKey: string;
  request: OpenRouterChatCompletionRequest;
  timeoutMs?: number;
  referer?: string;
  title?: string;
}): Promise<{ content: string; raw: OpenRouterChatCompletionResponse }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs ?? 300_000);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": params.referer ?? "https://bibliomnomnom.app",
        "X-Title": params.title ?? "bibliomnomnom",
      },
      body: JSON.stringify(params.request),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as OpenRouterChatCompletionResponse;

    if (!response.ok) {
      const providerMessage = data.error?.message ?? "Unknown error";
      throw new OpenRouterApiError({ status: response.status, providerMessage });
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    return { content, raw: data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const timeout = new Error(
        `OpenRouter request timed out after ${(params.timeoutMs ?? 300_000) / 1000}s`,
      );
      timeout.name = "AbortError";
      throw timeout;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
