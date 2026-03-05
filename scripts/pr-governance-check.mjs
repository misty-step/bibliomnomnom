#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CRITICAL_PATTERNS = [/\bcritical\b/i, /\bsev(?:erity)?[\s:=-]*0\b/i, /🔴/u, /🛑/u];
const HIGH_PATTERNS = [
  /\bhigh(?:\s+severity|\s+priority)?\b/i,
  /\bsev(?:erity)?[\s:=-]*1\b/i,
  /🟠/u,
];
const MEDIUM_PATTERNS = [
  /\bmedium(?:\s+severity|\s+priority)?\b/i,
  /\bsev(?:erity)?[\s:=-]*2\b/i,
  /🟡/u,
];
const LOW_PATTERNS = [
  /\blow(?:\s+severity|\s+priority)?\b/i,
  /\bsev(?:erity)?[\s:=-]*3\b/i,
  /🟢/u,
  /🔵/u,
];

const ACTIONABLE_PATTERNS = [
  /\bbreaking change\b/i,
  /\bregression\b/i,
  /\brisk\b/i,
  /\bsecurity\b/i,
  /\bvulnerab\w*\b/i,
  /\bmust fix\b/i,
  /\bneeds?\s+fix\b/i,
  /\b(?:failing|failure|failed)\b/i,
  /\berror\b/i,
  /\bblocked\b/i,
  /\bsuggestion:\b/i,
  /\bnot ready\b/i,
  /\baction required\b/i,
  /\brequested changes?\b/i,
  /\baddress (?:this|these)\b/i,
];

const MACHINE_PATH_PATTERNS = [
  /\/Users\/[A-Za-z0-9._-]+\/[A-Za-z0-9._\/\s-]+/g,
  /[A-Za-z]:\\+Users\\+[A-Za-z0-9._ -]+(?:\\+[A-Za-z0-9._ -]+)+/g,
  /\/home\/[A-Za-z0-9._-]+\/[A-Za-z0-9._\/\s-]+/g,
];

const PORTABILITY_PATH_PREFIXES = [".pi/", "docs/pi-"];
const PORTABILITY_EXACT_PATHS = new Set(["AGENTS.md", "docs/pi-local-workflow.md"]);
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".mp3",
  ".mp4",
  ".woff",
  ".woff2",
]);

const REVIEW_THREADS_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      author { login }
      reviewThreads(first: 100, after: $after) {
        nodes {
          id
          isResolved
          path
          comments(first: 50) {
            nodes {
              body
              author { login }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
`;

export function classifySeverity(text) {
  if (matchesAny(CRITICAL_PATTERNS, text)) return "critical";
  if (matchesAny(HIGH_PATTERNS, text)) return "high";
  if (matchesAny(MEDIUM_PATTERNS, text)) return "medium";
  if (matchesAny(LOW_PATTERNS, text)) return "low";
  if (isActionable(text)) return "medium";
  return "none";
}

export function isActionable(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return false;
  return matchesAny(ACTIONABLE_PATTERNS, normalized);
}

export function detectMachinePathViolations(files) {
  const violations = [];

  for (const file of files) {
    const content = String(file.content || "");
    for (const pattern of MACHINE_PATH_PATTERNS) {
      pattern.lastIndex = 0;
      let match = pattern.exec(content);
      while (match) {
        const matched = String(match[0] || "").trim();
        if (matched && !matched.startsWith("~")) {
          const line = lineNumberForIndex(content, match.index);
          violations.push({ path: file.path, line, snippet: matched });
        }
        match = pattern.exec(content);
      }
    }
  }

  return dedupeViolations(violations);
}

export function collectUnresolvedActionableThreadBlockers(threads, prAuthorLogin) {
  const blockers = [];
  const normalizedPrAuthor = String(prAuthorLogin || "")
    .trim()
    .toLowerCase();

  for (const thread of threads) {
    if (thread.isResolved) {
      continue;
    }

    const comments = Array.isArray(thread.comments?.nodes) ? thread.comments.nodes : [];
    if (comments.length === 0) {
      continue;
    }

    const externalComments = comments.filter((comment) => {
      const author = String(comment.author?.login || "")
        .trim()
        .toLowerCase();
      return Boolean(author) && author !== normalizedPrAuthor;
    });

    if (externalComments.length === 0) {
      continue;
    }

    const body = externalComments
      .map((comment) => String(comment.body || "").trim())
      .filter(Boolean)
      .join("\n");

    if (!body) {
      continue;
    }

    const severity = classifySeverity(body);
    const actionable = severity !== "none" || isActionable(body);
    if (!actionable) {
      continue;
    }

    blockers.push({
      path: thread.path || "(no-path)",
      severity,
      summary: summarize(body),
    });
  }

  return blockers;
}

export function shouldScanForPortability(filePath) {
  if (PORTABILITY_EXACT_PATHS.has(filePath)) {
    return true;
  }
  return PORTABILITY_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function dedupeViolations(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = `${item.path}:${item.line}:${item.snippet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function lineNumberForIndex(text, index) {
  const sliced = text.slice(0, Math.max(0, index));
  return sliced.split("\n").length;
}

function summarize(body) {
  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "review feedback";
  const normalized = firstLine.replace(/`/g, "").replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) return normalized;
  return `${normalized.slice(0, 117).trimEnd()}...`;
}

function matchesAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(text));
}

function runCommand(command, args, options = {}) {
  try {
    const stdout = execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    return { ok: true, stdout };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error?.stdout || ""),
      stderr: String(error?.stderr || error?.message || ""),
    };
  }
}

function runGhJson(args) {
  const result = runCommand("gh", args);
  if (!result.ok) {
    throw new Error(result.stderr || result.stdout || `gh ${args.join(" ")} failed`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Failed to parse JSON from gh ${args.join(" ")}: ${String(error)}`);
  }
}

function listTrackedFiles() {
  const result = runCommand("git", ["ls-files", "-z"]);
  if (!result.ok) {
    throw new Error(result.stderr || "git ls-files failed");
  }

  return result.stdout
    .split("\u0000")
    .map((file) => file.trim())
    .filter(Boolean);
}

function listTrackedStateFiles() {
  const result = runCommand("git", ["ls-files", "--", ".pi/state"]);
  if (!result.ok) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isLikelyBinary(filePath, content) {
  const extension = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) {
    return true;
  }
  return content.includes("\u0000");
}

function collectPortabilityViolations() {
  const trackedFiles = listTrackedFiles().filter(shouldScanForPortability);
  const scanned = [];

  for (const file of trackedFiles) {
    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    if (isLikelyBinary(file, content)) {
      continue;
    }

    scanned.push({ path: file, content });
  }

  return detectMachinePathViolations(scanned);
}

function fetchUnresolvedThreads(owner, repo, prNumber) {
  let after = null;
  let hasNextPage = true;
  const threads = [];
  let prAuthorLogin = "";
  let pages = 0;

  while (hasNextPage) {
    pages += 1;
    if (pages > 20) {
      throw new Error("Review thread pagination exceeded safety limit (20 pages)");
    }

    const args = [
      "api",
      "graphql",
      "-f",
      `query=${REVIEW_THREADS_QUERY}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${repo}`,
      "-F",
      `number=${prNumber}`,
      "-F",
      `after=${after ?? "null"}`,
    ];

    const payload = runGhJson(args);
    const pullRequest = payload?.data?.repository?.pullRequest;
    if (!pullRequest) {
      throw new Error("Pull request not found in GraphQL response");
    }

    prAuthorLogin = String(pullRequest?.author?.login || prAuthorLogin || "");

    const reviewThreads = pullRequest?.reviewThreads;
    const nodes = Array.isArray(reviewThreads?.nodes) ? reviewThreads.nodes : [];
    threads.push(...nodes);

    hasNextPage = Boolean(reviewThreads?.pageInfo?.hasNextPage);
    after = hasNextPage ? String(reviewThreads?.pageInfo?.endCursor || "") : null;
  }

  return { threads, prAuthorLogin };
}

export function runGovernanceChecks({ repository, prNumber }) {
  const failures = [];

  const trackedStateFiles = listTrackedStateFiles();
  if (trackedStateFiles.length > 0) {
    failures.push(
      [
        "Tracked transient state files are forbidden:",
        ...trackedStateFiles.map((file) => `  - ${file}`),
      ].join("\n"),
    );
  }

  const portabilityViolations = collectPortabilityViolations();
  if (portabilityViolations.length > 0) {
    failures.push(
      [
        "Machine-local absolute paths detected in portability-sensitive files:",
        ...portabilityViolations.map((item) => `  - ${item.path}:${item.line} -> ${item.snippet}`),
      ].join("\n"),
    );
  }

  if (prNumber && repository) {
    const [owner, repo] = repository.split("/");
    if (!owner || !repo) {
      failures.push(`Invalid GITHUB_REPOSITORY format: ${repository}`);
    } else {
      const { threads, prAuthorLogin } = fetchUnresolvedThreads(owner, repo, Number(prNumber));
      const blockers = collectUnresolvedActionableThreadBlockers(threads, prAuthorLogin);
      if (blockers.length > 0) {
        failures.push(
          [
            `Unresolved actionable review threads (hard blocker): ${blockers.length}`,
            ...blockers
              .slice(0, 10)
              .map((blocker) => `  - [${blocker.severity}] ${blocker.path}: ${blocker.summary}`),
          ].join("\n"),
        );
      }
    }
  }

  return failures;
}

function main() {
  const repository = String(process.env.GITHUB_REPOSITORY || "").trim();
  const prNumber = String(process.env.PR_NUMBER || "").trim();

  const failures = runGovernanceChecks({ repository, prNumber });

  if (failures.length === 0) {
    console.log("✅ PR governance checks passed.");
    if (!prNumber) {
      console.log("ℹ️ PR_NUMBER not set; conversation-thread check skipped.");
    }
    return;
  }

  console.error("❌ PR governance checks failed:\n");
  for (const failure of failures) {
    console.error(`${failure}\n`);
  }

  process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
