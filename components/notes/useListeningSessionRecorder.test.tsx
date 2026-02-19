import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useListeningSessionRecorder } from "./useListeningSessionRecorder";

const createSessionMock = vi.fn();
const markTranscribingMock = vi.fn();
const markSynthesizingMock = vi.fn();
const completeSessionMock = vi.fn();
const failSessionMock = vi.fn();
const mutationDispatcherMock = vi.fn();
const uploadMock = vi.fn();
const toastMock = vi.fn();
const captureMock = vi.fn();
const fetchMock = vi.fn();
const getUserMediaMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mutationDispatcherMock,
}));

vi.mock("@vercel/blob/client", () => ({
  upload: (...args: unknown[]) => uploadMock(...args),
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
    uploadMock.mockReset();
    toastMock.mockReset();
    captureMock.mockReset();
    fetchMock.mockReset();
    getUserMediaMock.mockReset();

    mutationDispatcherMock.mockImplementation((args: Record<string, unknown>) => {
      if ("bookId" in args) return createSessionMock(args);
      if ("audioUrl" in args) return markTranscribingMock(args);
      if ("transcript" in args) return completeSessionMock(args);
      if ("message" in args) return failSessionMock(args);
      return markSynthesizingMock(args);
    });

    createSessionMock.mockResolvedValueOnce("session_1").mockResolvedValueOnce("session_2");
    markTranscribingMock.mockResolvedValue(undefined);
    markSynthesizingMock.mockResolvedValue(undefined);
    completeSessionMock.mockResolvedValue(undefined);
    failSessionMock.mockResolvedValue(undefined);
    uploadMock.mockResolvedValue({ url: "https://example.com/audio.webm" });

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
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
    uploadMock
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ url: "https://example.com/audio.webm" });

    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 5_000);
    });

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(completeSessionMock).toHaveBeenCalledTimes(1));
    expect(failSessionMock).not.toHaveBeenCalled();
    expect(captureMock).toHaveBeenCalledWith(
      "audio_upload_attempt_failed",
      expect.objectContaining({ bookId: "book_1", attempt: 1, willRetry: true }),
    );
  });

  it("fails session when all upload retries are exhausted", async () => {
    uploadMock.mockRejectedValue(new Error("Storage unavailable"));

    render(<RecorderHarness bookId="book_1" />);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(createSessionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000 + 10_000);
    });

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(3));
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
    expect(uploadMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
