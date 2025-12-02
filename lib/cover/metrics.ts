type CoverEvent = {
  phase: "backfill";
  processed: number;
  updated: number;
  failures: number;
  durationMs: number;
  batchSize: number;
  source?: "import" | "manual" | "create" | string;
};

const redact = <T extends Record<string, unknown>>(payload: T): T => payload;

export const logCoverEvent = (event: CoverEvent) => {
  // Structured console log without PII (no titles/authors included)
  const safe = redact(event);
  console.info("cover.event", safe);
};
