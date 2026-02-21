import { ALERT_THRESHOLDS } from "./alert-thresholds";

type LogFn = (level: "error" | "warn", event: string, data: Record<string, unknown>) => void;

/**
 * Emit structured log warnings/errors when a session's estimated cost exceeds
 * the configured thresholds. Pure function; pass `log` from withObservability
 * (or a test spy) via the second argument.
 */
export function logSessionCostGuardrails(
  params: {
    sessionId?: string;
    estimatedCostUsd: number;
    model: string;
  },
  logFn: LogFn,
): void {
  const sessionId = params.sessionId ?? "unknown";

  if (params.estimatedCostUsd > ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD) {
    logFn("error", "listening_session_cost_cap_exceeded", {
      sessionId,
      estimatedCostUsd: params.estimatedCostUsd,
      model: params.model,
      hardCapUsd: ALERT_THRESHOLDS.SESSION_COST_HARD_CAP_USD,
    });
  } else if (params.estimatedCostUsd > ALERT_THRESHOLDS.SESSION_COST_WARN_USD) {
    logFn("warn", "listening_session_cost_elevated", {
      sessionId,
      estimatedCostUsd: params.estimatedCostUsd,
      model: params.model,
      warnThresholdUsd: ALERT_THRESHOLDS.SESSION_COST_WARN_USD,
    });
  }
}
