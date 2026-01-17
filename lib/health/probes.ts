import { type ServiceCheckResult } from "./types";

const DEFAULT_TIMEOUT_MS = 250;

function sanitizeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }

  if (error instanceof Error) {
    return error.name === "TypeError" ? "network-error" : error.name;
  }

  return "unknown-error";
}

async function probeUrl(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<ServiceCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const latencyMs = Date.now() - started;

    if (!response.ok) {
      return {
        status: "down",
        latencyMs,
        error: `http-${response.status}`,
      };
    }

    return { status: "up", latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - started;
    return {
      status: "down",
      latencyMs,
      error: sanitizeError(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeConvex(
  url?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ServiceCheckResult> {
  if (!url) return { status: "unknown" };
  return probeUrl(url, { method: "HEAD" }, timeoutMs);
}

export async function probeClerk(
  issuerDomain?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ServiceCheckResult> {
  if (!issuerDomain) return { status: "unknown" };
  const url = issuerDomain.endsWith("/")
    ? `${issuerDomain}.well-known/jwks.json`
    : `${issuerDomain}/.well-known/jwks.json`;

  return probeUrl(url, { method: "GET" }, timeoutMs);
}

export async function probeBlob(
  url?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ServiceCheckResult> {
  if (!url) return { status: "unknown" };
  return probeUrl(url, { method: "HEAD" }, timeoutMs);
}

/**
 * Probe Stripe API connectivity.
 * Uses balance.retrieve() which is the recommended health check endpoint.
 */
export async function probeStripe(
  secretKey?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ServiceCheckResult> {
  // Trim and validate key format to prevent header injection errors
  const key = (secretKey || "").trim();
  if (!key || !/^sk_(test|live)_[a-zA-Z0-9]+$/.test(key)) {
    return { status: "unknown" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    // Use balance.retrieve() - the recommended Stripe health check endpoint
    const response = await fetch("https://api.stripe.com/v1/balance", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    });

    const latencyMs = Date.now() - started;

    if (!response.ok) {
      return {
        status: "down",
        latencyMs,
        error: `http-${response.status}`,
      };
    }

    return { status: "up", latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - started;
    return {
      status: "down",
      latencyMs,
      error: sanitizeError(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function makeUnknownServices(): Record<
  "convex" | "clerk" | "blob" | "stripe",
  ServiceCheckResult
> {
  return {
    convex: { status: "unknown" },
    clerk: { status: "unknown" },
    blob: { status: "unknown" },
    stripe: { status: "unknown" },
  };
}
