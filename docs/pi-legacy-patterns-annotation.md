# Pi Legacy Pattern Annotation (Keep / Drop / Later)

Snapshot from reflection pass over:

- `~/.claude/skills/README.md`
- `~/.codex/commands/autopilot.md`
- `~/.codex/commands/pr.md`
- `~/.codex/commands/review-and-fix.md`

Goal: preserve high-signal workflow ideas while avoiding command/catalog bloat.

## Keep (adopt explicitly)

| Pattern                                                     | Source              | Why keep                                                       |
| ----------------------------------------------------------- | ------------------- | -------------------------------------------------------------- |
| Priority-first issue selection (P1 → P2 → P3)               | `autopilot.md`      | Strong execution discipline; reduces opportunistic drift.      |
| Structured PR feedback loop (triage → fix → verify → reply) | `review-and-fix.md` | Directly matches repeated friction in current repo history.    |
| "Codex/model writes first draft, human/lead curates"        | `autopilot.md`      | Good leverage model; keeps human time on judgment and quality. |
| Mandatory before/after evidence for user-facing changes     | `pr.md`             | Increases review clarity and rollback confidence.              |
| Severity-oriented review policy                             | `review-and-fix.md` | Aligns with hard-blocking critical/high findings.              |

## Drop (do not port)

| Pattern                                                                            | Source                              | Why drop                                                           |
| ---------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| Very large command trees (dozens of overlapping orchestrators)                     | `README.md`                         | High discovery and maintenance overhead; low marginal utility.     |
| Domain-specific command explosions (`/check-*`, `/log-*`, `/fix-*` for every area) | `README.md`                         | Encourages taxonomy management over shipping.                      |
| Overly prescriptive mega-orchestrators as default                                  | `autopilot.md`, `review-and-fix.md` | Brittle across repos; weak fit for focused repo-local conventions. |

## Later (pilot only if pain persists)

| Pattern                                      | Source              | Why later                                                                 |
| -------------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| Multi-reviewer parallel swarms for every PR  | `review-and-fix.md` | Useful for risky PRs, but expensive/noisy for routine changes.            |
| Full backlog grooming orchestration chain    | `README.md`         | High coordination cost; only justify with sustained planning bottlenecks. |
| Deep architecture hindsight pass on every PR | `autopilot.md`      | Valuable selectively; too heavy as a default merge gate.                  |

## Current operating decision

1. Keep the workflow **small and opinionated**:
   - one PR feedback command path,
   - one CI hard blocker for unresolved actionable threads,
   - one portability guard.
2. Add new commands only when repeated pain is evidenced across multiple runs.
3. Prefer extending existing primitives over introducing new top-level orchestration names.
