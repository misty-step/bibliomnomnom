import { describe, expect, it } from "vitest";

import { TRIAL_DAYS, TRIAL_DURATION_MS } from "../../lib/constants";

describe("Trial Constants", () => {
  describe("TRIAL_DAYS", () => {
    it("equals 14 days", () => {
      expect(TRIAL_DAYS).toBe(14);
    });
  });

  describe("TRIAL_DURATION_MS", () => {
    it("equals TRIAL_DAYS converted to milliseconds", () => {
      const expectedMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
      expect(TRIAL_DURATION_MS).toBe(expectedMs);
    });

    it("equals approximately 14 days in milliseconds", () => {
      // 14 days = 14 * 24 * 60 * 60 * 1000 = 1,209,600,000 ms
      expect(TRIAL_DURATION_MS).toBe(1_209_600_000);
    });

    it("is consistent with TRIAL_DAYS", () => {
      // Ensure the two constants stay in sync
      expect(TRIAL_DURATION_MS / (24 * 60 * 60 * 1000)).toBe(TRIAL_DAYS);
    });
  });
});
