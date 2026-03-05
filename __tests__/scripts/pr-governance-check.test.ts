import { describe, expect, it } from "vitest";

import {
  classifySeverity,
  collectUnresolvedActionableThreadBlockers,
  detectMachinePathViolations,
  isActionable,
  runGhJson,
  runGovernanceChecks,
  shouldScanForPortability,
} from "../../scripts/pr-governance-check.mjs";

describe("pr-governance-check portability", () => {
  it("detects machine-local absolute paths in scanned files", () => {
    const violations = detectMachinePathViolations([
      {
        path: ".pi/settings.json",
        content: '{"extensions": ["+/Users/phaedrus/.pi/agent/extensions/foo"]}',
      },
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe(".pi/settings.json");
    expect(violations[0]?.snippet).toContain("/Users/phaedrus");
  });

  it("ignores home-relative paths", () => {
    const violations = detectMachinePathViolations([
      {
        path: ".pi/settings.json",
        content: '{"extensions": ["+~/.pi/agent/extensions/foo"]}',
      },
    ]);

    expect(violations).toHaveLength(0);
  });

  it("detects Windows user paths with single backslashes", () => {
    const violations = detectMachinePathViolations([
      {
        path: ".pi/prompts/review.md",
        content: "Path: C:\\Users\\alice\\OneDrive\\Work Folder\\notes.txt",
      },
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.snippet).toContain("C:\\Users\\alice");
  });

  it("detects paths with spaces", () => {
    const violations = detectMachinePathViolations([
      {
        path: "docs/pi-local-workflow.md",
        content: "Stored under /Users/phaedrus/Library/Application Support/pi-agent/logs",
      },
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0]?.snippet).toContain("Application Support");
  });

  it("scans only portability-sensitive file surfaces", () => {
    expect(shouldScanForPortability(".pi/prompts/deliver.md")).toBe(true);
    expect(shouldScanForPortability("AGENTS.md")).toBe(true);
    expect(shouldScanForPortability("docs/pi-local-workflow.md")).toBe(true);
    expect(shouldScanForPortability("docs/other.md")).toBe(false);
    expect(shouldScanForPortability("src/app/page.tsx")).toBe(false);
  });
});

describe("pr-governance-check actionable classification", () => {
  it("does not classify generic discussion words as actionable", () => {
    expect(classifySeverity("Should we rename this helper?")).toBe("none");
    expect(classifySeverity("Please take a look when you have time.")).toBe("none");
    expect(classifySeverity("Question: is this expected behavior?")).toBe("none");
  });

  it("classifies explicit action-required language as actionable", () => {
    expect(classifySeverity("Action required before merge")).toBe("medium");
    expect(classifySeverity("Requested changes on the guardrail logic")).toBe("medium");
  });
});

describe("pr-governance-check isActionable", () => {
  it("returns false for empty or whitespace-only text", () => {
    expect(isActionable("")).toBe(false);
    expect(isActionable("   ")).toBe(false);
  });

  it("returns true for explicit actionable phrases", () => {
    expect(isActionable("breaking change in merge guard")).toBe(true);
    expect(isActionable("must fix before merge")).toBe(true);
    expect(isActionable("error in governance check path")).toBe(true);
  });
});

describe("pr-governance-check runGhJson", () => {
  it("returns parsed json when gh succeeds on first attempt", () => {
    const runCommandFn = () => ({ ok: true, stdout: '{"ok":true}' });

    const result = runGhJson(["api", "graphql"], { runCommandFn, sleepFn: () => undefined });

    expect(result).toEqual({ ok: true });
  });

  it("retries with linear backoff and succeeds on a later attempt", () => {
    const calls: number[] = [];
    const delays: number[] = [];
    const runCommandFn = () => {
      calls.push(Date.now());
      if (calls.length === 1) {
        return { ok: false, stdout: "", stderr: "temporary failure" };
      }
      return { ok: true, stdout: '{"done":true}' };
    };

    const result = runGhJson(["api", "graphql"], {
      retries: 3,
      backoffMs: 50,
      runCommandFn,
      sleepFn: (ms: number) => delays.push(ms),
    });

    expect(result).toEqual({ done: true });
    expect(calls).toHaveLength(2);
    expect(delays).toEqual([50]);
  });

  it("throws the last command error after exhausting retries", () => {
    const delays: number[] = [];
    const runCommandFn = () => ({ ok: false, stdout: "", stderr: "still failing" });

    expect(() =>
      runGhJson(["api", "graphql"], {
        retries: 3,
        backoffMs: 25,
        runCommandFn,
        sleepFn: (ms: number) => delays.push(ms),
      }),
    ).toThrow("still failing");

    expect(delays).toEqual([25, 50]);
  });

  it("throws on invalid json without retrying", () => {
    let attempts = 0;
    const delays: number[] = [];
    const runCommandFn = () => {
      attempts += 1;
      return { ok: true, stdout: "{not json}" };
    };

    expect(() =>
      runGhJson(["api", "graphql"], {
        retries: 3,
        backoffMs: 25,
        runCommandFn,
        sleepFn: (ms: number) => delays.push(ms),
      }),
    ).toThrow("Failed to parse JSON");

    expect(attempts).toBe(1);
    expect(delays).toHaveLength(0);
  });
});

describe("pr-governance-check runGovernanceChecks", () => {
  it("returns failure for invalid repository format when PR number is provided", () => {
    const failures = runGovernanceChecks({ repository: "invalid-format", prNumber: "247" });

    expect(Array.isArray(failures)).toBe(true);
    expect(failures.some((entry) => entry.includes("Invalid GITHUB_REPOSITORY format"))).toBe(true);
  });

  it("returns an array result when PR context is absent", () => {
    const failures = runGovernanceChecks({ repository: "", prNumber: "" });

    expect(Array.isArray(failures)).toBe(true);
  });
});

describe("pr-governance-check unresolved actionable threads", () => {
  it("blocks unresolved actionable external threads", () => {
    const blockers = collectUnresolvedActionableThreadBlockers(
      [
        {
          isResolved: false,
          path: "AGENTS.md",
          comments: {
            nodes: [
              {
                body: "This is a high-priority regression and should be fixed before merge.",
                author: { login: "reviewer" },
              },
            ],
          },
        },
      ],
      "phrazzld",
    );

    expect(blockers).toHaveLength(1);
    expect(blockers[0]?.severity).toBe("high");
    expect(blockers[0]?.path).toBe("AGENTS.md");
  });

  it("does not block resolved or self-only threads", () => {
    const blockers = collectUnresolvedActionableThreadBlockers(
      [
        {
          isResolved: true,
          path: "docs/pi-local-workflow.md",
          comments: {
            nodes: [
              {
                body: "must fix",
                author: { login: "reviewer" },
              },
            ],
          },
        },
        {
          isResolved: false,
          path: "docs/pi-local-workflow.md",
          comments: {
            nodes: [
              {
                body: "todo for myself",
                author: { login: "phrazzld" },
              },
            ],
          },
        },
      ],
      "phrazzld",
    );

    expect(blockers).toHaveLength(0);
  });

  it("ignores PR author actionable text when external comments are non-actionable", () => {
    const blockers = collectUnresolvedActionableThreadBlockers(
      [
        {
          isResolved: false,
          path: "scripts/pr-governance-check.mjs",
          comments: {
            nodes: [
              {
                body: "Looks good overall.",
                author: { login: "reviewer" },
              },
              {
                body: "must fix this",
                author: { login: "phrazzld" },
              },
            ],
          },
        },
      ],
      "phrazzld",
    );

    expect(blockers).toHaveLength(0);
  });
});
