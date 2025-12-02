import { describe, expect, it, vi } from "vitest";

import { logCoverEvent } from "../../../lib/cover/metrics";

describe("logCoverEvent", () => {
  it("logs structured cover event without throwing", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    logCoverEvent({
      phase: "backfill",
      processed: 10,
      updated: 8,
      failures: 2,
      durationMs: 1234,
      batchSize: 20,
      source: "import",
    });

    expect(spy).toHaveBeenCalledWith("cover.event", {
      phase: "backfill",
      processed: 10,
      updated: 8,
      failures: 2,
      durationMs: 1234,
      batchSize: 20,
      source: "import",
    });

    spy.mockRestore();
  });
});
