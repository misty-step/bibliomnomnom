/**
 * Semantic Release Configuration
 * Auto-generates CHANGELOG.md and GitHub Releases from conventional commits
 * Docs: https://semantic-release.gitbook.io/
 */
export default {
  branches: ["master"],
  plugins: [
    // Analyze commits to determine version bump
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "feat", release: "minor" },
          { type: "fix", release: "patch" },
          { type: "perf", release: "patch" },
          { type: "refactor", release: "patch" },
          { type: "docs", release: false },
          { type: "style", release: false },
          { type: "chore", release: false },
          { type: "test", release: false },
          { type: "build", release: false },
          { type: "ci", release: false },
        ],
      },
    ],
    // Generate release notes from commits
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        presetConfig: {
          types: [
            { type: "feat", section: "✨ Features" },
            { type: "fix", section: "🐛 Bug Fixes" },
            { type: "perf", section: "⚡ Performance" },
            { type: "refactor", section: "♻️ Refactoring" },
            { type: "docs", section: "📚 Documentation", hidden: true },
            { type: "style", section: "💄 Styling", hidden: true },
            { type: "chore", section: "🔧 Maintenance", hidden: true },
            { type: "test", section: "✅ Testing", hidden: true },
            { type: "build", section: "📦 Build", hidden: true },
            { type: "ci", section: "👷 CI/CD", hidden: true },
          ],
        },
      },
    ],
    // Update CHANGELOG.md
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle:
          "# Changelog\n\nAll notable changes to bibliomnomnom are documented here.\n",
      },
    ],
    // Update package.json version and commit changes
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    // Create GitHub Release
    "@semantic-release/github",
  ],
};
