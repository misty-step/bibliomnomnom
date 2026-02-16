#!/usr/bin/env tsx
/**
 * Release Notes Generator
 *
 * Parses CHANGELOG.md and generates:
 * 1. Structured JSON for each release (technical)
 * 2. LLM-synthesized product notes (user-focused)
 *
 * Uses OpenRouter with DeepSeek V3.2 for cost-effective synthesis.
 *
 * Usage:
 *   bun run generate:releases           # Generate missing releases
 *   bun run generate:releases --dry-run # Parse only, no LLM calls
 *   bun run generate:releases --force   # Regenerate all releases
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { parseChangelog } from "../lib/releases/parser";
import type { Release, ReleaseManifest } from "../lib/releases/types";

/**
 * OpenRouter configuration
 * Using DeepSeek V3.2 via OpenRouter: GPT-5 class at ~$0.24/$0.38 per 1M tokens
 */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-v3.2";

const CONTENT_DIR = join(process.cwd(), "content/releases");
const CHANGELOG_PATH = join(process.cwd(), "CHANGELOG.md");

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

/**
 * Build the system prompt for release notes generation.
 * Encodes bibliomnomnom's voice and strict rules for user-focused copy.
 */
function buildSystemPrompt(): string {
  return `You are a product writer for bibliomnomnom, a book tracking app for voracious readers. Your job is to translate technical changes into benefits readers care about.

VOICE:
- Warm and welcoming, like a cozy reading nook
- Friendly but not overly casual
- Celebrate wins without being cheesy
- Second person: "you" not "users"
- Book/reading metaphors when natural

CRITICAL RULES - NEVER VIOLATE:
1. NO TECHNICAL JARGON. Never mention:
   - Hook names (useX, useSomething)
   - Component names (BookCard, SettingsPanel)
   - Internal APIs, functions, or implementation details
   - Technical patterns (centralized, abstraction, refactor)

2. BENEFITS OVER MECHANISMS. Always ask "so what does this mean for the reader?"
   - BAD: "Added a useOptimisticUpdate hook for instant feedback"
   - GOOD: "Made changes feel instant—add a book and see it on your shelf immediately"

3. VALUE OVER FEATURES. Focus on what readers can DO, not what we built.
   - BAD: "Implemented soft delete with automatic restore functionality"
   - GOOD: "Accidentally remove a book? Just add it again and your notes come back"

4. SKIP INTERNAL CHANGES. Don't mention:
   - Refactoring, code cleanup, or "under the hood" work
   - Dependencies, libraries, or technical debt
   - Unless they directly improve speed, reliability, or user experience

5. KEEP IT REAL. Write like you're telling a friend what's new, not writing a press release.`;
}

/**
 * Generate product-focused release notes using OpenRouter.
 */
async function generateProductNotes(release: Release, apiKey: string): Promise<string> {
  // Format changes for the prompt - strip technical markers
  const changesSummary = release.changes
    .filter((c) => c.type === "feat" || c.type === "fix" || c.type === "perf")
    .map((c) => {
      const type = c.type === "feat" ? "NEW" : c.type === "fix" ? "FIXED" : "FASTER";
      return `- ${type}: ${c.description}`;
    })
    .join("\n");

  // Count internal-only changes
  const internalCount = release.changes.filter(
    (c) => c.type === "chore" || c.type === "refactor" || c.type === "docs",
  ).length;

  const userPrompt = `Write release notes for bibliomnomnom v${release.version} (${release.date}).

TECHNICAL CHANGELOG (translate these into reader benefits):
${changesSummary || "(No user-facing changes listed)"}
${internalCount > 0 ? `\n(Plus ${internalCount} internal improvements for stability)` : ""}

REQUIREMENTS:
- 2-3 short paragraphs, under 120 words total
- Lead with the most valuable change for readers
- No bullet points, no headers—just conversational paragraphs
- If only internal changes, write about improved reliability/stability
- Remember: NO technical jargon, hook names, or implementation details`;

  const response = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://bibliomnomnom.com",
      "X-Title": "bibliomnomnom",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  // Debug: log finish reason if not completed normally
  if (data.choices?.[0]?.finish_reason !== "stop") {
    console.log(`    ⚠ Finish reason: ${data.choices?.[0]?.finish_reason}`);
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Check if release content already exists.
 */
function releaseExists(version: string): boolean {
  const dir = join(CONTENT_DIR, `v${version}`);
  return existsSync(join(dir, "changelog.json")) && existsSync(join(dir, "notes.md"));
}

/**
 * Save release content to disk.
 */
function saveRelease(release: Release, productNotes: string): void {
  const dir = join(CONTENT_DIR, `v${release.version}`);
  mkdirSync(dir, { recursive: true });

  // Save structured changelog
  writeFileSync(join(dir, "changelog.json"), JSON.stringify(release, null, 2));

  // Save product notes
  writeFileSync(join(dir, "notes.md"), productNotes);

  console.log(`  ✓ Saved v${release.version}`);
}

/**
 * Update the manifest file.
 */
function updateManifest(releases: Release[]): void {
  const manifest: ReleaseManifest = {
    latest: releases[0]?.version || "",
    versions: releases.map((r) => r.version),
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(join(CONTENT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`  ✓ Updated manifest (${manifest.versions.length} versions)`);
}

async function main() {
  console.log("Release Notes Generator");
  console.log("=======================\n");

  // Check if CHANGELOG.md exists
  if (!existsSync(CHANGELOG_PATH)) {
    console.log("⏭️  No CHANGELOG.md found, nothing to generate");
    process.exit(0);
  }

  // Parse changelog
  console.log("Parsing CHANGELOG.md...");
  const releases = parseChangelog(CHANGELOG_PATH);
  console.log(`  Found ${releases.length} releases\n`);

  if (releases.length === 0) {
    console.log("⏭️  No releases found in CHANGELOG.md");
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log("DRY RUN - Parsed releases:");
    for (const release of releases) {
      const feats = release.changes.filter((c) => c.type === "feat").length;
      const fixes = release.changes.filter((c) => c.type === "fix").length;
      console.log(`  v${release.version} (${release.date}): ${feats} features, ${fixes} fixes`);
    }
    return;
  }

  // Ensure content directory exists
  mkdirSync(CONTENT_DIR, { recursive: true });

  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    if (process.env.CI) {
      console.error("❌ OPENROUTER_API_KEY not set in CI environment");
      process.exit(1);
    }
    console.log("⏭️  OPENROUTER_API_KEY not set, skipping synthesis");
    process.exit(0);
  }

  // Generate missing releases
  console.log(`Using model: ${MODEL} via OpenRouter`);
  console.log("Generating release notes...");
  let generated = 0;
  let skipped = 0;

  for (const release of releases) {
    if (!FORCE && releaseExists(release.version)) {
      skipped++;
      continue;
    }

    console.log(`  Generating v${release.version}...`);
    const productNotes = await generateProductNotes(release, apiKey);
    saveRelease(release, productNotes);
    generated++;

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  // Update manifest
  console.log("\nUpdating manifest...");
  updateManifest(releases);

  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
