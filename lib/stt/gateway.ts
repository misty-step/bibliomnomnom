import { captureError, log } from "@/lib/api/withObservability";
import type { FallbackPolicy, FinalTranscript, ProviderFlags, STTProvider } from "./types";
import { STTError } from "./types";
import { createAdapter, resolveProviderFlags } from "./registry";

function isEnabled(provider: STTProvider, flags: ProviderFlags): boolean {
  const v = flags[provider];
  // assemblyai defaults off; elevenlabs/deepgram default on
  if (provider === "assemblyai") return v === true;
  return v !== false;
}

/**
 * Transcribe audio through the STT gateway.
 *
 * Routing order: primary → secondary (if configured).
 * Providers are skipped when:
 *   - kill-switched via flags / environment
 *   - no API key configured
 *
 * Throws STTError if no provider succeeds.
 */
export async function transcribeWithGateway(params: {
  audioBytes: ArrayBuffer;
  mimeType: string;
  policy: FallbackPolicy;
  flags?: ProviderFlags;
}): Promise<FinalTranscript> {
  const { audioBytes, mimeType, policy } = params;
  const flags = params.flags ?? resolveProviderFlags();

  const ordered: STTProvider[] = [policy.primary];
  if (policy.secondary && policy.secondary !== policy.primary) {
    ordered.push(policy.secondary);
  }

  const errors: string[] = [];

  for (const provider of ordered) {
    if (!isEnabled(provider, flags)) {
      log("info", "stt_provider_skipped", { provider, reason: "kill_switch" });
      continue;
    }

    const adapter = createAdapter(provider);
    if (!adapter) {
      log("warn", "stt_provider_skipped", { provider, reason: "no_api_key" });
      continue;
    }

    try {
      const result = await adapter.transcribe({ audioBytes, mimeType });
      return result;
    } catch (err) {
      captureError(err, {
        provider,
        retryable: err instanceof STTError ? err.retryable : false,
        mimeType,
      });
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg}`);
      log("warn", "stt_provider_failed", {
        provider,
        error: msg,
        retryable: err instanceof STTError ? err.retryable : false,
      });
    }
  }

  const finalError = new STTError({
    code: "provider_error",
    provider: policy.primary,
    message: errors.join(" | ") || "All STT providers failed",
    retryable: false,
  });
  captureError(finalError, { providers: ordered });
  throw finalError;
}
