# ADR 0007: Custom Clerk-Next.js Auth Adapter for Convex

## Status

Accepted

## Date

2025-12 (inferred from codebase)

## Context

Convex provides `ConvexProviderWithClerk` for Clerk integration. It expects a `useAuth` hook from `@clerk/clerk-react`.

In Next.js 16, this creates a problem:

- `@clerk/nextjs` provides SSR-safe hooks
- `@clerk/clerk-react` hooks fail during hydration (wrong provider context)
- `ConvexProviderWithClerk` internally calls `useAuth` from whatever you pass

### Symptoms

```
Error: useAuth can only be used within a ClerkProvider
```

This happens even though `<ClerkProvider>` wraps the app, because Next.js's version doesn't expose the same context as React's version.

### Considered Approaches

1. **Install both packages** - Import React version just for Convex
2. **Patch Convex SDK** - Fork and fix the import
3. **Custom adapter hook** - Wrap Next.js hook in compatible interface

## Decision

**Create custom `useClerkNextjsAuth()` adapter that wraps `@clerk/nextjs`'s `useAuth` to match `ConvexProviderWithClerk`'s expected interface.**

### Implementation

```typescript
// ConvexClientProvider.tsx
import { useAuth } from "@clerk/nextjs"; // Next.js SSR-safe version

function useClerkNextjsAuth() {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole } = useAuth();

  const wrappedGetToken = useCallback(
    async (options: { template?: "convex"; skipCache?: boolean }) => {
      try {
        const token = await getToken(options);
        return token ?? null;
      } catch {
        return null;
      }
    },
    [getToken],
  );

  return useMemo(
    () => ({
      isLoaded,
      isSignedIn,
      getToken: wrappedGetToken,
      orgId,
      orgRole,
    }),
    [isLoaded, isSignedIn, wrappedGetToken, orgId, orgRole],
  );
}

// Usage
<ConvexProviderWithClerk client={convex} useAuth={useClerkNextjsAuth}>
```

### Why Wrap `getToken`?

The raw `getToken` from Next.js can:

- Return `undefined` instead of `null`
- Throw on errors

The wrapper:

- Normalizes to `null` on missing token
- Catches errors gracefully

This matches what `ConvexProviderWithClerk` expects.

## Consequences

### Positive

- **SSR compatible** - Uses Next.js's SSR-safe hooks
- **No extra packages** - Reuses existing `@clerk/nextjs`
- **Type-safe** - Return type matches expected interface

### Negative

- **Coupling** - If Convex changes expected interface, adapter breaks
- **Hidden complexity** - Why custom hook exists isn't obvious

### Mitigation

Document clearly in component. Add comment explaining Next.js 16 hydration issue.

## Alternatives Rejected

1. **Dual package install** - Bundle bloat, version conflicts
2. **SDK fork** - Maintenance burden, drift risk
3. **Skip Convex-Clerk integration** - Would lose JWT passthrough benefits
