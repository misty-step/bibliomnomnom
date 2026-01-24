#!/usr/bin/env node
/**
 * Synthesize Release Notes
 *
 * Fetches the latest GitHub release and uses an LLM via OpenRouter to transform
 * technical changelog into user-friendly release notes.
 *
 * Requirements:
 * - GITHUB_TOKEN: For fetching/updating releases
 * - OPENROUTER_API_KEY: For LLM synthesis
 */

// Use GITHUB_REPOSITORY env var (set by GitHub Actions) with fallback
const repo = process.env.GITHUB_REPOSITORY || "misty-step/bibliomnomnom";
const [REPO_OWNER, REPO_NAME] = repo.split("/");
if (!REPO_OWNER || !REPO_NAME) {
  throw new Error(`Invalid GITHUB_REPOSITORY: ${repo}`);
}

// DeepSeek V3.2: GPT-5 class performance at ~$0.24/$0.38 per 1M tokens
const OPENROUTER_MODEL = "deepseek/deepseek-v3.2";

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!githubToken) {
    if (process.env.CI) {
      console.error("❌ GITHUB_TOKEN not set in CI environment");
      process.exit(1);
    }
    console.log("⏭️  GITHUB_TOKEN not set, skipping synthesis");
    process.exit(0);
  }

  if (!openrouterKey) {
    if (process.env.CI) {
      console.error("❌ OPENROUTER_API_KEY not set in CI environment");
      process.exit(1);
    }
    console.log("⏭️  OPENROUTER_API_KEY not set, skipping synthesis");
    process.exit(0);
  }

  // Fetch latest release
  console.log("📦 Fetching latest release...");
  const releaseRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    {
      signal: AbortSignal.timeout(10000), // 10s timeout
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (!releaseRes.ok) {
    if (releaseRes.status === 404) {
      console.log("⏭️  No releases found yet, skipping synthesis");
      process.exit(0);
    }
    throw new Error(`Failed to fetch release: ${releaseRes.status}`);
  }

  const release = await releaseRes.json();
  console.log(`📋 Found release: ${release.tag_name}`);

  // Check if already synthesized (has our marker)
  if (release.body?.includes("<!-- synthesized -->")) {
    console.log("✅ Already synthesized, skipping");
    process.exit(0);
  }

  const technicalNotes = release.body || "";

  // Call OpenRouter API (OpenAI-compatible format)
  console.log(`🤖 Synthesizing with ${OPENROUTER_MODEL}...`);
  const prompt = `You are a product manager writing release notes for bibliomnomnom, a book tracking app for voracious readers.

Transform these technical release notes into user-friendly notes that readers will appreciate.

Guidelines:
- Lead with what users can now DO, not what we changed
- Use friendly, warm language (we have a cozy, bibliophile aesthetic)
- Group related changes together
- Skip internal/technical changes users don't care about
- Keep it concise - 3-5 bullet points max
- Use book/reading metaphors where natural

Technical changelog:
${technicalNotes}

Write the user-friendly version (markdown format, no preamble):`;

  const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(30000), // 30s timeout for LLM
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://bibliomnomnom.com",
      "X-Title": "bibliomnomnom Release Notes",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!llmRes.ok) {
    const error = await llmRes.text();
    throw new Error(`OpenRouter API error: ${llmRes.status} ${error}`);
  }

  const llmData = await llmRes.json();
  const synthesized = llmData.choices?.[0]?.message?.content || "";

  if (!synthesized) {
    console.log("⚠️  Empty response from LLM, keeping original notes");
    process.exit(0);
  }

  // Update release with synthesized notes
  console.log("📝 Updating release...");
  const newBody = `${synthesized}

---

<details>
<summary>Technical changelog</summary>

${technicalNotes}

</details>

<!-- synthesized -->`;

  const updateRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/${release.id}`,
    {
      method: "PATCH",
      signal: AbortSignal.timeout(10000), // 10s timeout
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: newBody }),
    }
  );

  if (!updateRes.ok) {
    throw new Error(`Failed to update release: ${updateRes.status}`);
  }

  console.log("✅ Release notes synthesized successfully!");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
