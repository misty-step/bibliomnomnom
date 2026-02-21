/**
 * Alert thresholds for listening session cost guardrails.
 *
 * Used by logSessionCostGuardrails() to emit structured log warnings.
 *
 * Future thresholds (not yet wired to alerting):
 * - Failure rate: 20% in 1 hour → critical
 * - Synthesis timeout rate: 15% in 1 hour → alert
 * - Daily user cost: warn $1.00 / cap $5.00
 */
export const ALERT_THRESHOLDS = {
  SESSION_COST_WARN_USD: 0.1,
  SESSION_COST_HARD_CAP_USD: 0.5,
} as const;
