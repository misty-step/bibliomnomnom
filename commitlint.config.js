/**
 * Commitlint Configuration
 * Enforces Conventional Commits specification
 * Docs: https://commitlint.js.org/
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Allow longer subject lines for descriptive commits
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 100],
    // Allow these types
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation changes
        "style", // Code style changes (formatting, etc.)
        "refactor", // Code refactoring
        "perf", // Performance improvements
        "test", // Adding or updating tests
        "build", // Build system changes
        "ci", // CI/CD changes
        "chore", // Maintenance tasks
        "revert", // Revert previous commit
      ],
    ],
  },
};

export default config;
