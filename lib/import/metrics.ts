type ImportEvent = {
  phase: "preview" | "commit";
  importRunId: string;
  sourceType: string;
  counts?: { rows?: number; created?: number; merged?: number; skipped?: number; errors?: number };
  tokenUsage?: number;
  durationMs?: number;
  page?: number;
};

const redact = <T extends Record<string, unknown>>(payload: T): T => payload;

export const logImportEvent = (event: ImportEvent) => {
  // Intentional structured console log without PII (titles/authors excluded by design)
  const safe = redact(event);
  // eslint-disable-next-line no-console
  console.info("import.event", safe);
};
