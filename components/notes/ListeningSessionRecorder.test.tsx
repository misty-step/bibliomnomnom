import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { ListeningSessionRecorder } from "./ListeningSessionRecorder";

const startSessionMock = vi.fn();
const stopAndProcessMock = vi.fn();
const discardSessionMock = vi.fn();

const hookState = {
  sessions: [],
  isRecording: true,
  isProcessing: false,
  elapsedMs: 12_000,
  warningActive: false,
  liveTranscript: "a live thought",
  capNotice: null,
  lastTranscript: "",
  lastProvider: "",
  lastArtifacts: null,
  speechRecognitionSupported: true,
  remainingSeconds: 42,
  capRolloverReady: false,
};

vi.mock("@/components/notes/useListeningSessionRecorder", () => ({
  useListeningSessionRecorder: () => ({
    ...hookState,
    startSession: startSessionMock,
    stopAndProcess: stopAndProcessMock,
    discardSession: discardSessionMock,
  }),
}));

describe("ListeningSessionRecorder", () => {
  beforeEach(() => {
    startSessionMock.mockReset();
    stopAndProcessMock.mockReset();
    discardSessionMock.mockReset();
  });

  it("renders full-screen recording UI with accessible controls", () => {
    render(<ListeningSessionRecorder bookId={"book_1" as Id<"books">} />);

    expect(screen.getByRole("dialog", { name: "Voice recording in progress" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop recording and process session" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard current recording" })).toBeInTheDocument();
    expect(screen.getByLabelText("Live transcript preview")).toHaveTextContent("a live thought");
  });

  it("opens discard confirmation on Escape and confirms discard", () => {
    render(<ListeningSessionRecorder bookId={"book_1" as Id<"books">} />);

    expect(screen.queryByText("Discard this recording?")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByText("Discard this recording?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(discardSessionMock).toHaveBeenCalledTimes(1);
  });

  it("opens discard confirmation when discard button is clicked", () => {
    render(<ListeningSessionRecorder bookId={"book_1" as Id<"books">} />);

    fireEvent.click(screen.getByRole("button", { name: "Discard current recording" }));

    expect(screen.getByText("Discard this recording?")).toBeInTheDocument();
  });
});
