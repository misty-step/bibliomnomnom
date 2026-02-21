import { describe, expect, it, vi } from "vitest";
import { logSessionCostGuardrails } from "@/lib/listening-sessions/cost-guardrails";
import { ALERT_THRESHOLDS } from "@/lib/listening-sessions/alert-thresholds";

describe("logSessionCostGuardrails", () => {
  it("logs error when cost exceeds hard cap", () => {
    const logFn = vi.fn();
    const overCap = ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD + 0.01;

    logSessionCostGuardrails(
      { sessionId: "sess-1", estimatedCostUsd: overCap, model: "google/gemini-2.0-flash" },
      logFn,
    );

    expect(logFn).toHaveBeenCalledOnce();
    expect(logFn).toHaveBeenCalledWith(
      "error",
      "listening_session_cost_cap_exceeded",
      expect.objectContaining({
        sessionId: "sess-1",
        estimatedCostUsd: overCap,
        model: "google/gemini-2.0-flash",
        hardCapUsd: ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD,
      }),
    );
  });

  it("logs warn when cost exceeds warn threshold but not hard cap", () => {
    const logFn = vi.fn();
    const overWarn = ALERT_THRESHOLDS.SESSION_COST_WARN_USD + 0.01;

    logSessionCostGuardrails(
      { sessionId: "sess-2", estimatedCostUsd: overWarn, model: "openai/gpt-4o" },
      logFn,
    );

    expect(logFn).toHaveBeenCalledOnce();
    expect(logFn).toHaveBeenCalledWith(
      "warn",
      "listening_session_cost_elevated",
      expect.objectContaining({
        sessionId: "sess-2",
        estimatedCostUsd: overWarn,
        warnThresholdUsd: ALERT_THRESHOLDS.SESSION_COST_WARN_USD,
      }),
    );
  });

  it("does not log when cost is below warn threshold", () => {
    const logFn = vi.fn();
    const underWarn = ALERT_THRESHOLDS.SESSION_COST_WARN_USD * 0.5;

    logSessionCostGuardrails(
      { sessionId: "sess-3", estimatedCostUsd: underWarn, model: "google/gemini-2.0-flash" },
      logFn,
    );

    expect(logFn).not.toHaveBeenCalled();
  });

  it("does not log at exactly the warn threshold (strict greater-than)", () => {
    const logFn = vi.fn();
    logSessionCostGuardrails(
      {
        sessionId: "sess-4",
        estimatedCostUsd: ALERT_THRESHOLDS.SESSION_COST_WARN_USD,
        model: "google/gemini-2.0-flash",
      },
      logFn,
    );
    expect(logFn).not.toHaveBeenCalled();
  });

  it("logs warn (not error) at exactly the hard cap — strict greater-than", () => {
    // == hard cap → not > hard cap → falls into else-if → warn
    const logFn = vi.fn();
    logSessionCostGuardrails(
      {
        sessionId: "sess-5",
        estimatedCostUsd: ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD,
        model: "google/gemini-2.0-flash",
      },
      logFn,
    );
    expect(logFn).toHaveBeenCalledOnce();
    const [level] = logFn.mock.calls[0]!;
    expect(level).toBe("warn");
  });

  it("uses 'unknown' for sessionId when not provided", () => {
    const logFn = vi.fn();
    const overCap = ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD + 0.01;

    logSessionCostGuardrails(
      { estimatedCostUsd: overCap, model: "google/gemini-2.0-flash" },
      logFn,
    );

    expect(logFn).toHaveBeenCalledWith(
      "error",
      "listening_session_cost_cap_exceeded",
      expect.objectContaining({ sessionId: "unknown" }),
    );
  });

  it("logs error (not warn) when cost exceeds both thresholds", () => {
    const logFn = vi.fn();
    // Hard cap > warn threshold by definition; exceeding hard cap should not also log warn
    const overCap = ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD + 1;

    logSessionCostGuardrails(
      { sessionId: "sess-6", estimatedCostUsd: overCap, model: "google/gemini-2.0-flash" },
      logFn,
    );

    expect(logFn).toHaveBeenCalledOnce();
    const [level] = logFn.mock.calls[0]!;
    expect(level).toBe("error");
  });
});
