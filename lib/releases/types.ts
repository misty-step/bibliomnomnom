/**
 * Release Notes System Types
 *
 * Shared types for parsing CHANGELOG.md and generating release notes.
 */

export type ChangeType = "feat" | "fix" | "perf" | "refactor" | "docs" | "chore" | "style" | "test";

export interface ChangelogEntry {
  /** Conventional commit type */
  type: ChangeType;
  /** Optional scope (e.g., "auth", "books") */
  scope?: string;
  /** Human-readable description */
  description: string;
  /** GitHub PR number if available */
  pr?: number;
  /** Git commit SHA (short) if available */
  commit?: string;
  /** Whether this is a breaking change */
  breaking?: boolean;
}

export interface Release {
  /** Semantic version (e.g., "1.6.0") */
  version: string;
  /** ISO date string */
  date: string;
  /** All changes in this release */
  changes: ChangelogEntry[];
  /** Compare URL to previous version */
  compareUrl?: string;
}

export interface ReleaseWithNotes extends Release {
  /** LLM-generated product-focused release notes */
  productNotes: string;
}

export interface ReleaseManifest {
  /** Most recent version */
  latest: string;
  /** All versions in descending order */
  versions: string[];
  /** When manifest was last updated */
  generatedAt: string;
}

/** Human-readable labels for change types */
export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  feat: "New Features",
  fix: "Bug Fixes",
  perf: "Performance",
  refactor: "Refactoring",
  docs: "Documentation",
  chore: "Maintenance",
  style: "Styling",
  test: "Testing",
};

/** Order for displaying change types (user-facing first) */
export const CHANGE_TYPE_ORDER: ChangeType[] = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "docs",
  "style",
  "test",
  "chore",
];
