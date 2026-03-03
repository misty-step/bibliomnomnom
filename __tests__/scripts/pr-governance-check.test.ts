import { describe, expect, it } from "vitest";

import {
  collectUnresolvedActionableThreadBlockers,
  detectMachinePathViolations,
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

  it("scans only portability-sensitive file surfaces", () => {
    expect(shouldScanForPortability(".pi/prompts/deliver.md")).toBe(true);
    expect(shouldScanForPortability("AGENTS.md")).toBe(true);
    expect(shouldScanForPortability("docs/pi-local-workflow.md")).toBe(true);
    expect(shouldScanForPortability("docs/other.md")).toBe(false);
    expect(shouldScanForPortability("src/app/page.tsx")).toBe(false);
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
});
