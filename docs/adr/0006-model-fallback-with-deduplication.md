# ADR 0006: LLM Model Fallback with Deduplication

## Status

Accepted

## Date

2025-12 (inferred from codebase)

## Context

The application uses OpenRouter for multiple LLM features:

- Import text extraction
- Reader profile generation
- OCR (photo quote capture)

OpenRouter proxies to various models (Gemini, DeepSeek, Qwen). Models can be:

- **Rate limited (429)** - Too many requests
- **Unavailable (503)** - Model down for maintenance
- **Slow** - Queue depth varies by model

### Problem

If the primary model fails, the feature fails. Users see errors even when alternative models could handle the request.

### Considered Approaches

1. **Single model, fail fast** - Accept occasional failures
2. **Fallback list** - Try models in sequence
3. **Smart routing** - Pick model based on real-time availability

## Decision

**Maintain ordered fallback list per feature. Try each model in sequence on 429/503. Deduplicate list to avoid retrying same model.**

### Implementation

1. **Model Configuration** (`lib/ai/models.ts`):

   ```typescript
   export const DEFAULT_PROFILE_MODEL = "google/gemini-3-flash-preview";
   export const PROFILE_FALLBACK_MODELS = [
     "deepseek/deepseek-chat", // 10x cheaper
     "qwen/qwen3-235b-a22b", // Extremely cheap
   ];
   ```

2. **Fallback Logic** (`actions/profileInsights.ts`):

   ```typescript
   async function callWithFallback(apiKey: string, prompt: string): Promise<string> {
     const models = process.env.OPENROUTER_PROFILE_MODEL
       ? [process.env.OPENROUTER_PROFILE_MODEL, ...PROFILE_FALLBACK_MODELS]
       : [DEFAULT_PROFILE_MODEL, ...PROFILE_FALLBACK_MODELS];

     // Deduplicate in case env var duplicates a fallback
     const uniqueModels = [...new Set(models)];

     for (const model of uniqueModels) {
       try {
         return await openRouterChatCompletion({ model, ... });
       } catch (e) {
         if (e instanceof OpenRouterApiError && (e.status === 429 || e.status === 503)) {
           console.log(`Model ${model} unavailable (${e.status}), trying fallback...`);
           continue;
         }
         throw e; // Other errors propagate immediately
       }
     }
     throw new Error("All models unavailable");
   }
   ```

3. **Environment Overrides**:
   - `OPENROUTER_PROFILE_MODEL` - Override primary for profile generation
   - `OPENROUTER_IMPORT_MODEL` - Override primary for import extraction
   - Override takes first position in fallback chain

### Why Deduplicate?

If `OPENROUTER_PROFILE_MODEL=deepseek/deepseek-chat`, the chain would be:

```
[deepseek/deepseek-chat, gemini-3-flash, deepseek/deepseek-chat, qwen]
                                          ^^^^^^^^^^^^^^^^^^^^^^^^
                                          Duplicate! Would retry failing model
```

`[...new Set(models)]` ensures each model tried exactly once.

## Consequences

### Positive

- **Resilient** - Single model failure doesn't break feature
- **Cost-effective** - Fallbacks are progressively cheaper
- **Configurable** - Env vars allow per-environment tuning

### Negative

- **Latency on failure** - Must wait for timeout before trying next
- **Quality variance** - Fallback models may produce different quality

### Key Invariant

**Only retry on 429/503.** Other errors (400 bad request, 401 auth) propagate immediately. Retrying would waste time and potentially cost money.

## Alternatives Rejected

1. **Parallel model calls** - Wasteful, first response wins but all charged
2. **External availability service** - Complexity, another dependency
3. **Client-side model selection** - Exposes model strategy to users
