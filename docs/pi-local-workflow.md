# Pi Local Workflow

This repository is bootstrapped for bibliomnomnom using repo-local Pi config under `.pi/`.

## Recommended run pattern

1. Use meta mode when evolving architecture/config primitives:
   - `pictl meta`
2. Use build mode for normal project delivery:
   - `pictl build`
3. Use local prompt workflows:
   - `/discover`
   - `/design`
   - `/deliver`
   - `/review`
4. Optional capabilities (if extensions are installed in your environment):
   - memory workflows: `/memory-ingest`, `/memory-search`, `/memory-context`
   - orchestration workflows: `/pipeline repo-foundation-v1 <goal>`, `/pipeline repo-delivery-v1 <goal>`
   - PR feedback orchestration: `/pr-feedback-loop` (global extension command)
5. Governance guardrails:
   - run `bun run pr:governance` to enforce portability + PR conversation readiness checks

## Local artifacts

- `.pi/settings.json`
- `AGENTS.md` (project persona + operating policy)
- `.pi/agents/*.md`
- `.pi/agents/teams.yaml`
- `.pi/agents/pipelines.yaml`
- `.pi/prompts/*.md`
