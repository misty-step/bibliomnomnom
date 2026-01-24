#!/usr/bin/env node
/**
 * Synthesize Release Notes
 *
 * Fetches the latest GitHub release and uses Gemini to transform
 * technical changelog into user-friendly release notes.
 *
 * Requirements:
 * - GITHUB_TOKEN: For fetching/updating releases
 * - GEMINI_API_KEY: For LLM synthesis
 */

const REPO_OWNER = "phaedrus";
const REPO_NAME = "bibliomnomnom";
const GEMINI_MODEL = "gemini-2.5-flash-preview-05-20";

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!githubToken) {
    console.log("⏭️  GITHUB_TOKEN not set, skipping synthesis");
    process.exit(0);
  }

  if (!geminiKey) {
    console.log("⏭️  GEMINI_API_KEY not set, skipping synthesis");
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

  // Call Gemini API
  console.log("🤖 Synthesizing with Gemini...");
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

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(30000), // 30s timeout for LLM
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const error = await geminiRes.text();
    throw new Error(`Gemini API error: ${geminiRes.status} ${error}`);
  }

  const geminiData = await geminiRes.json();
  const synthesized =
    geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!synthesized) {
    console.log("⚠️  Empty response from Gemini, keeping original notes");
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
