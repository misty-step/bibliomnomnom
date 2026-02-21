import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useListeningSessionRecorder } from "./useListeningSessionRecorder";

const createSessionMock = vi.fn();
const markTranscribingMock = vi.fn();
const markSynthesizingMock = vi.fn();
const completeSessionMock = vi.fn();
const failSessionMock = vi.fn();
const mutationDispatcherMock = vi.fn();
const toastMock = vi.fn();
const captureMock = vi.fn();
const fetchMock = vi.fn();
const getUserMediaMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mutationDispatcherMock,
}));

vi.mock("@/lib/hooks/useAuthedQuery", () => ({
  useAuthedQuery: () => [],
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: captureMock }),
}));

class MockMediaRecorder extends EventTarget {
  static isTypeSupported(_mimeType: string) {
    return true;
  }

  readonly stream: MediaStream;
  readonly mimeType: string;
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "audio/webm";
  }

  start() {
    this.state = "recording";
    this.ondataavailable?.({
      data: new Blob(["audio"], { type: this.mimeType }),
    } as BlobEvent);
  }

  stop() {
    this.state = "inactive";
    this.dispatchEvent(new Event("stop"));
  }
}

function RecorderHarness({ bookId }: { bookId: string }) {
  const recorder = useListeningSessionRecorder(bookId as never);

  return (
    <div>
      <button type="button" onClick={() => void recorder.startSession()}>
        start
      </button>
      <button type="button" onClick={() => void recorder.stopAndProcess(false)}>
        stop
      </button>
      <span data-testid="rollover">{recorder.capRolloverReady ? "ready" : "idle"}</span>
      <span data-testid="recording">{recorder.isRecording ? "recording" : "idle"}</span>
      <span data-testid="notice">{recorder.capNotice ?? ""}</span>
      <span data-testid="transcript">{recorder.lastTranscript}</span>
    </div>
  );
}

describe("useListeningSessionRecorder", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    createSessionMock.mockReset();
    markTranscribingMock.mockReset();
    markSynthesizingMock.mockReset();
    completeSessionMock.mockReset();
    failSessionMock.mockReset();
    mutationDispatcherMock.mockReset();
    toastMock.mockReset();
    captureMock.mockReset();
    fetchMock.mockReset();
    getUserMediaMock.mockReset();

    mutationDispatcherMock.mockImplementation((args: Record<string, unknown>) => {
      if ("bookId" in args) return createSessionMock(args);
      if ("durationMs" in args) return markTranscribingMock(args);
      if ("transcript" in args) return completeSessionMock(args);
      if ("message" in args) return failSessionMock(args);
      return markSynthesizingMock(args);
    });

    createSessionMock.mockResolvedValueOnce("session_1").mockResolvedValueOnce("session_2");
    markTranscribingMock.mockResolvedValue(undefined);
    markSynthesizingMock.mockResolvedValue(undefined);
    completeSessionMock.mockResolvedValue(undefined);
    failSessionMock.mockResolvedValue(undefined);

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/listening-sessions/") && url.includes("/upload")) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }
      if (url.includes("/api/listening-sessions/transcribe")) {
        return {
          ok: true,
          json: async () => ({ transcript: "hello transcript", provider: "deepgram" }),
        } as Response;
      }
      if (url.includes("/api/listening-sessions/synthesize")) {
        return {
          ok: true,
          json: async () => ({
            artifacts: {
              insights: [],
              openQuestions: [],
              quotes: [],
              followUpQuestions: [],
              contextExpansions: [],
            },
          }),
        } as Response;
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    const trackStopMock = vi.fn();
    getUserMediaMock.mockResolvedValue({
      getTracks: () => [{ stop: trackStopMock }],
    } as unknown as MediaStream);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sets rollover ready after cap processing and clears it on next session start", async () => {
    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("rollover")).toHaveTextContent("idle");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });

    await waitFor(() => expect(completeSessionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("rollover")).toHaveTextContent("ready"));

    expect(captureMock).toHaveBeenCalledWith(
      "cap_warning_shown",
      expect.objectContaining({
        bookId: "book_1",
        warningDurationMs: 60_000,
        capDurationMs: 1_800_000,
      }),
    );
    expect(captureMock).toHaveBeenCalledWith(
      "cap_reached",
      expect.objectContaining({
        bookId: "book_1",
        warningDurationMs: 60_000,
        capDurationMs: 1_800_000,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("rollover")).toHaveTextContent("idle"));

    expect(captureMock).toHaveBeenCalledWith(
      "session_rollover_started",
      expect.objectContaining({
        bookId: "book_1",
        reason: "cap_reached",
        capDurationMs: 1_800_000,
      }),
    );
  });

  it("keeps rollover cue and avoids rollover telemetry when restart fails", async () => {
    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });

    await waitFor(() => expect(screen.getByTestId("rollover")).toHaveTextContent("ready"));
    const rolloverCaptureCallsBefore = captureMock.mock.calls.filter(
      ([event]) => event === "session_rollover_started",
    ).length;

    getUserMediaMock.mockRejectedValueOnce(new Error("Microphone permission denied"));
    fireEvent.click(screen.getByRole("button", { name: "start" }));

    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(screen.getByTestId("rollover")).toHaveTextContent("ready");
    const rolloverCaptureCallsAfter = captureMock.mock.calls.filter(
      ([event]) => event === "session_rollover_started",
    ).length;
    expect(rolloverCaptureCallsAfter).toBe(rolloverCaptureCallsBefore);
  });

  it("keeps rollover disabled when capped processing fails", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/listening-sessions/") && url.includes("/upload")) {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }
      if (url.includes("/api/listening-sessions/transcribe")) {
        return {
          ok: false,
          json: async () => ({ error: "transcribe failed" }),
        } as Response;
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });

    await waitFor(() => expect(failSessionMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("rollover")).toHaveTextContent("idle");
  });

  it("resets rollover and cap notice when book changes", async () => {
    const { rerender } = render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });

    await waitFor(() => expect(screen.getByTestId("rollover")).toHaveTextContent("ready"));
    await waitFor(() => expect(screen.getByTestId("notice")).toHaveTextContent("auto-processed"));
    await waitFor(() => expect(screen.getByTestId("transcript")).toHaveTextContent("hello"));

    rerender(<RecorderHarness bookId="book_2" />);

    await waitFor(() => expect(screen.getByTestId("rollover")).toHaveTextContent("idle"));
    expect(screen.getByTestId("notice")).toHaveTextContent("");
    expect(screen.getByTestId("transcript")).toHaveTextContent("");
  });

  it("fails in-flight session and clears timers when switching books", async () => {
    const { rerender } = render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("recording")).toHaveTextContent("recording");

    rerender(<RecorderHarness bookId="book_2" />);
    await waitFor(() =>
      expect(failSessionMock).toHaveBeenCalledWith({
        sessionId: "session_1",
        message: "Session ended because book context changed.",
      }),
    );
    await waitFor(() => expect(screen.getByTestId("recording")).toHaveTextContent("idle"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    });
    expect(captureMock).not.toHaveBeenCalledWith(
      "cap_reached",
      expect.objectContaining({ bookId: "book_1" }),
    );
  });

  it("retries upload on transient failure and completes on second attempt", async () => {
    let uploadAttempts = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/listening-sessions/") && url.includes("/upload")) {
        uploadAttempts += 1;
        if (uploadAttempts === 1) {
          return {
            ok: false,
            json: async () => ({ error: "Network error" }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }
      if (url.includes("/api/listening-sessions/transcribe")) {
        return {
          ok: true,
          json: async () => ({ transcript: "hello transcript", provider: "deepgram" }),
        } as Response;
      }
      if (url.includes("/api/listening-sessions/synthesize")) {
        return {
          ok: true,
          json: async () => ({
            artifacts: {
              insights: [],
              openQuestions: [],
              quotes: [],
              followUpQuestions: [],
              contextExpansions: [],
            },
          }),
        } as Response;
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 5_000);
    });

    await waitFor(() => {
      const uploadCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = String(input);
        return url.includes("/api/listening-sessions/") && url.includes("/upload");
      });
      expect(uploadCalls).toHaveLength(2);
    });
    await waitFor(() => expect(completeSessionMock).toHaveBeenCalledTimes(1));
    expect(failSessionMock).not.toHaveBeenCalled();
    expect(captureMock).toHaveBeenCalledWith(
      "audio_upload_attempt_failed",
      expect.objectContaining({ bookId: "book_1", attempt: 1, willRetry: true }),
    );
  });

  it("fails session when all upload retries are exhausted", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/listening-sessions/") && url.includes("/upload")) {
        return {
          ok: false,
          json: async () => ({ error: "Storage unavailable" }),
        } as Response;
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 10_000);
    });

    await waitFor(() => {
      const uploadCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = String(input);
        return url.includes("/api/listening-sessions/") && url.includes("/upload");
      });
      expect(uploadCalls).toHaveLength(3);
    });
    await waitFor(() =>
      expect(failSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/upload failed after/i) }),
      ),
    );
    expect(completeSessionMock).not.toHaveBeenCalled();
    // Terminal attempt must report willRetry: false
    expect(captureMock).toHaveBeenCalledWith(
      "audio_upload_attempt_failed",
      expect.objectContaining({ bookId: "book_1", attempt: 3, willRetry: false }),
    );
  });

  // ─── AC 1: start ──────────────────────────────────────────────────────────

  it("start creates session, flips isRecording, and begins elapsed timer", async () => {
    render(<RecorderHarness bookId="book_1" />);

    expect(screen.getByTestId("recording")).toHaveTextContent("idle");

    fireEvent.click(screen.getByRole("button", { name: "start" }));

    await waitFor(() => expect(screen.getByTestId("recording")).toHaveTextContent("recording"));
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({ bookId: "book_1" }));
    expect(getUserMediaMock).toHaveBeenCalledWith(
      expect.objectContaining({ audio: expect.objectContaining({ echoCancellation: true }) }),
    );
  });

  // ─── AC 2: stop happy path ─────────────────────────────────────────────────

  it("manual stop uploads audio, transcribes, synthesizes, and completes session", async () => {
    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    // Advance past MIN_AUDIO_DURATION_MS (1s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    fireEvent.click(screen.getByRole("button", { name: "stop" }));

    await waitFor(() => {
      const uploadCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/upload"),
      );
      expect(uploadCalls).toHaveLength(1);
    });
    await waitFor(() => {
      const transcribeCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/transcribe"),
      );
      expect(transcribeCalls).toHaveLength(1);
    });
    await waitFor(() => {
      const synthesizeCalls = fetchMock.mock.calls.filter(([input]) =>
        String(input).includes("/synthesize"),
      );
      expect(synthesizeCalls).toHaveLength(1);
    });
    await waitFor(() => expect(completeSessionMock).toHaveBeenCalledTimes(1));
    expect(failSessionMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Session processed" }));
  });

  // ─── AC 3: error paths ────────────────────────────────────────────────────

  it("surfaces degraded toast but completes with raw transcript when synthesis fails", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/upload")) {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url.includes("/transcribe")) {
        return {
          ok: true,
          json: async () => ({ transcript: "hello", provider: "deepgram" }),
        } as Response;
      }
      if (url.includes("/synthesize")) {
        return {
          ok: false,
          json: async () => ({ error: "LLM overloaded" }),
        } as Response;
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    fireEvent.click(screen.getByRole("button", { name: "stop" }));

    await waitFor(() => expect(completeSessionMock).toHaveBeenCalledTimes(1));
    expect(failSessionMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Synthesis degraded", variant: "destructive" }),
    );
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Session processed" }));
  });

  // ─── AC 4: unmount ────────────────────────────────────────────────────────

  it("calls failSession best-effort when unmounted while recording", async () => {
    const { unmount } = render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("recording")).toHaveTextContent("recording");

    unmount();

    await waitFor(() =>
      expect(failSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session_1",
          message: "Session ended before processing completed.",
        }),
      ),
    );
  });

  // ─── AC 3 (continued): recording too short ────────────────────────────────

  it("fails session with clear message when recording is too short", async () => {
    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    // Advance only 100ms so durationMs < MIN_AUDIO_DURATION_MS (1000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    fireEvent.click(screen.getByRole("button", { name: "stop" }));

    await waitFor(() =>
      expect(failSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringMatching(/too short/i) }),
      ),
    );
    const uploadCalls = fetchMock.mock.calls.filter(([input]) => {
      const url = String(input);
      return url.includes("/api/listening-sessions/") && url.includes("/upload");
    });
    expect(uploadCalls).toHaveLength(0);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
