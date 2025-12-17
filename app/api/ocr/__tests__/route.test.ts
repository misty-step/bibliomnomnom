import { describe, expect, it, vi, afterEach } from "vitest";
import { POST } from "../route";

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalOpenRouterModel = process.env.OPENROUTER_MODEL;
const originalOpenRouterOcrModel = process.env.OPENROUTER_OCR_MODEL;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

vi.mock("@/lib/api/withObservability", async () => {
  const mod = await vi.importActual<typeof import("@/lib/api/withObservability")>(
    "@/lib/api/withObservability",
  );
  return {
    ...mod,
    withObservability: (
      handler: Parameters<typeof mod.withObservability>[0],
      _operationName: Parameters<typeof mod.withObservability>[1],
      _options?: Parameters<typeof mod.withObservability>[2],
    ) => handler,
  };
});

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

describe("ocr route", () => {
  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    process.env.OPENROUTER_API_KEY = "test-key";

    const res = await POST(
      new Request("https://example.com/api/ocr", {
        method: "POST",
        headers: { "x-request-id": "req1", "Content-Type": "application/json" },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toBe("req1");
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns helpful error on invalid OpenRouter model id", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    process.env.OPENROUTER_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: "some-model is not a valid model ID", code: 400 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      new Request("https://example.com/api/ocr", {
        method: "POST",
        headers: { "x-request-id": "req2", "Content-Type": "application/json" },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(res.headers.get("x-request-id")).toBe("req2");
    expect(body.code).toBe("OCR_MODEL_INVALID");
  });

  it("formats OCR output into paragraphs", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_123" });
    process.env.OPENROUTER_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: ["First line", "second line", "", "Second para", "wrap-", "ped."].join("\n"),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(
      new Request("https://example.com/api/ocr", {
        method: "POST",
        headers: { "x-request-id": "req3", "Content-Type": "application/json" },
        body: JSON.stringify({ image: "data:image/jpeg;base64,AA==" }),
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe("First line second line\n\nSecond para wrapped.");
  });
});

function restoreEnvVar(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

afterEach(() => {
  restoreEnvVar("OPENROUTER_API_KEY", originalOpenRouterApiKey);
  restoreEnvVar("OPENROUTER_OCR_MODEL", originalOpenRouterOcrModel);
  restoreEnvVar("OPENROUTER_MODEL", originalOpenRouterModel);
  restoreEnvVar("NEXT_PUBLIC_APP_URL", originalAppUrl);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
