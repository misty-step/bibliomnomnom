## Planning Report

**Spec**: TASK.md (Health endpoint dual-mode)  
**Tasks Generated**: 6  
**Total Estimate**: 5.0h  
**Critical Path**: Types → Probes → Route → Tests (3.0h)

### Task Summary

| Phase | Tasks | Estimate | Dependencies |
|-------|-------|----------|--------------|
| Setup | 1 | 0.5h | None |
| Core | 3 | 2.5h | Setup |
| Quality | 1 | 1.0h | Core |
| Docs | 1 | 1.0h | Core |

### Critical Path

1. Define health types (0.5h) →  
2. Implement probe helpers (1.0h) →  
3. Dual-mode health route (1.0h) →  
4. Vitest coverage (0.5h)  
Total: 3.0h

### TODO

- [x] Health types + contracts  
  ```
  Files:
  - lib/health/types.ts (new)
  Goal: Define stable DTOs for health responses; keep interface tiny, implementation free to change.
  Approach:
  1) Add enums/unions: HealthStatus ("healthy"|"degraded"|"unhealthy"), ServiceStatus ("up"|"down"|"unknown").
  2) Define ServiceCheckResult { status, latencyMs?, error? } and HealthPayload { status, timestamp, uptime, environment, version, services }.
  3) Export helpers for status promotion (combine service states → overall).
  Success Criteria:
  - Types cover all fields from TASK.md responses.
  - No secret-bearing fields; version/env are strings only.
  Tests: None yet (covered via probe/route tests).
  Estimate: 0.5h
  ```

- [x] Probe helpers with timeouts  
  ```
  Files:
  - lib/health/probes.ts (new)
  - lib/health/types.ts (reuse)
  Goal: Reachability probes for Convex/Clerk/Blob with per-check timeout and error sanitization.
  Approach:
  1) Add util runWithTimeout(fn, ms) rejecting on deadline.
  2) Implement probeConvex(url), probeClerk(url), probeBlob(url) using HEAD/GET lightweight endpoint (assume env URLs available); return ServiceCheckResult.
  3) Map fetch/network errors to status "down" with sanitized error codes only.
  4) Default to status "unknown" when url missing.
  Success Criteria:
  - Each probe resolves within 250ms timeout, never throws uncaught.
  - No env values logged or echoed.
  Tests:
  - Unit tests mocking fetch success/timeout/error; ensure status mapping.
  Estimate: 1.0h
  ```

- [x] Dual-mode health route  
  ```
  Files:
  - app/api/health/route.ts
  - lib/api/withObservability.ts (optional log field tweaks)
  - lib/health/types.ts, lib/health/probes.ts (use)
  Goal: Support shallow (default) and deep (?mode=deep or X-Health-Mode: deep) responses with correct status codes and cache headers.
  Approach:
  1) Parse mode from query/header; shallow skips probes (services=unknown); deep runs probes in parallel with overall 750ms timeout.
  2) Compute overall status from service results; 200 for healthy, 503 for degraded/unhealthy.
  3) Return payload with timestamp, uptime, env, git SHA (7 chars), services map; keep runtime nodejs and Cache-Control no-store/no-cache/must-revalidate.
  4) Ensure health route excluded from analytics/Sentry (guard in withObservability or local flag).
  Success Criteria:
  - Shallow: 200, services unknown, includes env/version/uptime/timestamp.
  - Deep: dependency down → 503 with degraded/unhealthy; up → 200 with latencyMs.
  - No unhandled exceptions; response within timeout budget.
  Tests: Covered in next task.
  Estimate: 1.0h
  ```

- [x] Structured observability for health  
  ```
  Files:
  - lib/api/withObservability.ts
  - app/api/health/route.ts (usage)
  Goal: Add structured fields (operation, mode, status, durationMs) and skip Sentry/analytics noise.
  Approach:
  1) Extend withObservability to accept context metadata bag and omit error capture for health op.
  2) In health route, log mode/status and probe summary; redact errors.
  3) Keep interface minimal to avoid leaking implementation.
  Success Criteria:
  - Logs show operation="health-check", mode, status, durationMs.
  - No PII or env values logged.
  - No changes to other routes’ behavior.
  Tests: Unit test for metadata logging optional; manual check via mocked console acceptable.
  Estimate: 0.5h
  depends: Dual-mode health route
  ```

- [ ] Vitest coverage for health endpoint  
  ```
  Files:
  - app/api/health/__tests__/route.test.ts (new)
  - lib/health/__tests__/probes.test.ts (new)
  Goal: Guard contract for shallow/deep modes and probe behaviors.
  Approach:
  1) Mock global fetch for success, timeout, network error cases.
  2) Assert status codes + body shape for shallow vs deep, down service → 503.
  3) Snapshot minimal payload (services keys, status strings, version length).
  Success Criteria:
  - All tests pass under pnpm test; coverage exercises probe timeouts and status mapping.
  - No network calls made during tests.
  Estimate: 0.5h
  depends: Dual-mode health route, Probe helpers
  ```

- [ ] Docs + monitor guidance  
  ```
  Files:
  - DEPLOYMENT.md (health section)
  - README.md (verify step)
  Goal: Document deep-mode usage and monitor setup; warn to keep monitors on shallow mode.
  Approach:
  1) Update curl examples with ?mode=deep for manual diagnostics only.
  2) Add note to monitoring section: external monitors should call default (no mode) to avoid load; include expected JSON shape + 200/503 behavior.
  3) Mention build SHA presence for deploy verification.
  Success Criteria:
  - Docs match implemented contract; no ambiguity about URLs or modes.
  - No new env requirements introduced.
  Estimate: 1.0h
  depends: Dual-mode health route
  ```

### Risks
- Probe targets still unclear (Convex/Clerk/Blob endpoints) → confirm before implementing probes.
- Potential rate limits on dependency endpoints → may require caching/throttling (not in scope now).

### Out of Scope (backlog)
- Background heartbeat job storing last-success in Convex.
- Authenticated verbose diagnostics endpoint.
