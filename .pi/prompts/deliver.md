---
description: Execute a scoped change using planner -> worker -> reviewer flow
---

Task: $@

Preferred path:

- If `/pipeline` is available, run `/pipeline repo-delivery-v1 $@`.
- Otherwise execute the same flow manually using `.pi/agents/planner.md`, `.pi/agents/worker.md`, and `.pi/agents/reviewer.md`.

PR feedback hygiene (required when touching an active PR):

- Fetch fresh PR state before final replies (`pulls/<pr>/comments`, `pulls/<pr>/reviews`, `issues/<pr>/comments`).
- Reply on each actionable thread with classification/severity/decision/change/verification.
- If a thread is fixed, resolve that conversation; if not resolved, state the blocker explicitly.

Keep the patch focused, verify with relevant repo checks, and report residual risk.
