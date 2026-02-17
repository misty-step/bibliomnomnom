import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { log } from "@/lib/api/withObservability";

if (typeof window !== "undefined") {
  throw new Error("listening session entitlements is server-only");
}

type GetClerkToken = (options: { template: string }) => Promise<string | null>;

type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
  errorMessage?: string;
};

export type ListeningSessionEntitlementResult =
  | { ok: true; convex: ConvexHttpClient }
  | { ok: false; status: number; error: string };

const MISCONFIGURED = "Voice sessions are temporarily unavailable. Please try again shortly.";
const SUBSCRIPTION_REQUIRED = "Subscription required to use voice sessions.";

async function getAuthedConvexClient(params: {
  requestId: string;
  clerkId: string;
  getToken: GetClerkToken;
}): Promise<ListeningSessionEntitlementResult> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    log("error", "listening_session_missing_convex_url", {
      requestId: params.requestId,
      clerkIdPrefix: params.clerkId.slice(0, 8),
    });
    return { ok: false, status: 503, error: MISCONFIGURED };
  }

  const token = await params.getToken({ template: "convex" });
  if (!token) {
    log("error", "listening_session_missing_convex_auth_token", {
      requestId: params.requestId,
      clerkIdPrefix: params.clerkId.slice(0, 8),
    });
    return { ok: false, status: 401, error: "Authentication token missing." };
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);
  return { ok: true, convex };
}

async function ensureAccess(convex: ConvexHttpClient): Promise<boolean> {
  let access = (await convex.query(api.subscriptions.checkAccess)) as {
    hasAccess: boolean;
    reason?: string;
  };

  if (!access.hasAccess && access.reason === "no_subscription") {
    try {
      await convex.mutation(api.subscriptions.ensureTrialExists, {});
      access = (await convex.query(api.subscriptions.checkAccess)) as {
        hasAccess: boolean;
        reason?: string;
      };
    } catch {
      // Best-effort: fall through to deny.
    }
  }

  return access.hasAccess;
}

async function enforceRateLimit(
  convex: ConvexHttpClient,
  config: RateLimitConfig,
): Promise<{ ok: true } | { ok: false; status: 429; error: string }> {
  const result = (await convex.mutation(api.rateLimit.check, {
    key: config.key,
    limit: config.limit,
    windowMs: config.windowMs,
  })) as { success: boolean };

  if (!result.success) {
    return {
      ok: false,
      status: 429,
      error: config.errorMessage ?? "Too many requests. Please try again later.",
    };
  }

  return { ok: true };
}

export async function requireListeningSessionEntitlement(params: {
  requestId: string;
  clerkId: string;
  getToken: GetClerkToken;
  rateLimit?: RateLimitConfig;
}): Promise<ListeningSessionEntitlementResult> {
  const convexResult = await getAuthedConvexClient(params);
  if (!convexResult.ok) return convexResult;

  const { convex } = convexResult;
  const allowed = await ensureAccess(convex);
  if (!allowed) {
    log("info", "listening_session_access_denied", {
      requestId: params.requestId,
      clerkIdPrefix: params.clerkId.slice(0, 8),
    });
    return { ok: false, status: 402, error: SUBSCRIPTION_REQUIRED };
  }

  if (params.rateLimit) {
    const rateLimit = await enforceRateLimit(convex, params.rateLimit);
    if (!rateLimit.ok) {
      log("warn", "listening_session_rate_limited", {
        requestId: params.requestId,
        clerkIdPrefix: params.clerkId.slice(0, 8),
        key: params.rateLimit.key,
      });
      return { ok: false, status: rateLimit.status, error: rateLimit.error };
    }
  }

  return convexResult;
}
