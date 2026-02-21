/**
 * Alert thresholds for listening session observability.
 * These constants define the parameters for Sentry alert rules.
 *
 * Alert rules are configured via Sentry dashboard or CLI using these thresholds:
 * - HIGH_FAILURE_RATE_PERCENT: Alert when session failure rate exceeds this in 1 hour
 * - SYNTHESIS_TIMEOUT_RATE_PERCENT: Alert when synthesis timeouts exceed this in 1 hour
 * - COST_SPIKE_USD: Alert when per-user cost exceeds this in 1 day
 */
export const ALERT_THRESHOLDS = {
  HIGH_FAILURE_RATE_PERCENT: 20, // 20% failure rate = critical alert
  SYNTHESIS_TIMEOUT_RATE_PERCENT: 15, // 15% synthesis timeout rate = alert
  SESSION_COST_WARN_USD: 0.1, // Per-session warning threshold
  SESSION_COST_HARD_CAP_USD: 0.5, // Per-session hard cap (log error)
  DAILY_USER_COST_WARN_USD: 1.0, // Per-user daily cost warning
  DAILY_USER_COST_CAP_USD: 5.0, // Per-user daily cost cap
} as const;
