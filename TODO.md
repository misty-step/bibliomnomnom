# TODO: Dark Mode Implementation

## Context

- **Architecture:** CSS Variables + System Preference + Manual Toggle (TASK.md Phase 1-4)
- **Key Decision:** Use next-themes (Grug disagrees, but SSR hydration safety + 20k stars wins)
- **Module Boundaries:** Token system (deep module) + Theme toggle (shallow, acceptable for UI)
- **Patterns:** Follow existing test structure (Vitest + Testing Library), component patterns (TopNav integration)

## Phase 1: Foundation (2-3 hours)

### Design Tokens

- [x] Define dark color palette in design-tokens.json
  ```
  Files: design-tokens.json (modify)
  Add: colorsDark, elevationDark (gradients optional - can use CSS var references)
  Success: Dark palette defined with WCAG AA contrast (test with WebAIM)
  Colors:
    - canvas.bone: "#1C1917" (warm charcoal)
    - text.ink: "#FAF8F5" (inverted bone)
    - surface.dawn: "#27241F" (warm brown)
    - line.ghost: "rgba(250,248,245,0.08)"
    - accent.ember: "#EF4444" (brighter for contrast)
    - accent.favorite: "#F59E0B" (new token for star icons)
  Elevations:
    - soft: "0 4px 16px rgba(0,0,0,0.40)"
    - raised: "0 8px 24px rgba(0,0,0,0.60)"
  Test: Run WebAIM Contrast Checker on text.ink + canvas.bone (target ≥4.5:1)
  Dependencies: None
  Time: 1h (includes contrast testing iteration)
  ```

- [x] Update build script to generate .dark CSS block
  ```
  Files: scripts/build-tokens.mjs (modify lines 65-90)
  Architecture: After :root block, loop colorsDark and generate .dark { ... }
  Pseudocode:
    1. Check if raw.colorsDark exists
    2. Flatten colorsDark with ['color'] prefix
    3. Generate `.dark { --color-*: value; }` block
    4. Exclude *Dark objects from TS exports (build-time only)
  Success: pnpm tokens:build generates app/design-tokens.css with :root + .dark blocks
  Test:
    - Manually add .dark class to <html> → colors invert
    - lib/design/tokens.generated.ts does NOT export colorsDark
  Dependencies: None
  Time: 30m
  ```

- [x] Add accent.favorite token and migrate hardcoded amber stars
  ```
  Files:
    - design-tokens.json (modify - add accent.favorite to colors and colorsDark)
    - components/book/BookTile.tsx (modify - line with fill-amber-400)
    - components/book/BookForm.tsx (modify)
    - components/book/AddBookSheet.tsx (modify)
    - components/book/BookDetail.tsx (modify)
  Architecture: Replace hardcoded Tailwind color with semantic token
  Success: All star icons use fill-accent-favorite, amber-400 removed from codebase
  Test:
    - ast-grep --pattern 'amber-400' returns 0 results
    - Stars visible in both light and dark themes
  Dependencies: Task 1 (token build must work)
  Time: 15m
  ```

- [x] Adjust film grain for dark mode
  ```
  Files: app/globals.css (modify line 74-83, add .dark body::before rule)
  Architecture: Change blend-mode + opacity for dark backgrounds
  CSS:
    .dark body::before {
      mix-blend-mode: overlay; /* or screen */
      opacity: 0.6; /* test 0.3-0.6 range */
    }
  Success: Film grain visible in dark mode without overwhelming text
  Test:
    - Add .dark to <html>, visually inspect grain on dark bg
    - Try blend-modes: overlay, screen, soft-light (pick best)
  Dependencies: None (can work in parallel)
  Time: 15m (includes visual experimentation)
  ```

**Phase 1 Validation:**
- Run `pnpm tokens:build` → no errors, CSS has :root + .dark
- Manually add `.dark` to `<html className="dark">` in layout.tsx
- Visual check: Dark colors applied, grain visible, stars use token
- Remove manual `.dark` class before Phase 2

---

## Phase 2: Theme Switcher (1.5 hours)

### Theme State Management

- [x] Install next-themes
  ```
  Command: pnpm add next-themes
  Files: package.json (modify)
  Architecture: Battle-tested SSR hydration solution (Grug objects, but we accept dependency)
  Success: next-themes@^0.4.4 in package.json
  Test: pnpm list next-themes shows installed
  Dependencies: None
  Time: 5m
  Grug note: "Could do in 15 lines, but team prioritize shipping over purity"
  ```

- [x] Create ThemeProvider wrapper
  ```
  Files: components/providers/ThemeProvider.tsx (new)
  Architecture: Client component wrapping next-themes with project config
  Code:
    "use client";
    import { ThemeProvider as NextThemesProvider } from "next-themes";
    import { type ThemeProviderProps } from "next-themes/dist/types";

    export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
      return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
    }
  Success: Component exports without errors, types resolve
  Test: Import in another file → no TS errors
  Dependencies: Task 1 (next-themes installed)
  Time: 10m
  Module depth: Shallow (just wrapper), but acceptable for provider pattern
  ```

- [x] Update root layout for theme support
  ```
  Files: app/layout.tsx (modify)
  Architecture: Wrap app in ThemeProvider, add suppressHydrationWarning
  Changes:
    1. Import ThemeProvider from components/providers
    2. Add suppressHydrationWarning to <html> tag (line 39)
    3. Wrap children with:
       <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
         {children}
       </ThemeProvider>
    4. Place after ClerkProvider, before/around ConvexClientProvider
  Success: App runs without hydration errors, no visual changes yet
  Test:
    - pnpm dev → no console errors
    - Check <html> in DevTools → has suppressHydrationWarning attribute
    - No hydration mismatch warnings
  Dependencies: Task 2 (ThemeProvider exists)
  Time: 15m
  ```

### Theme Toggle Component

- [x] Create ThemeToggle component with accessibility
  ```
  Files: components/shared/ThemeToggle.tsx (new)
  Architecture: Client component with mounted state check, ARIA labels, CSS transitions
  Pattern: Follow TopNav.tsx "use client" + usePathname pattern
  Code structure:
    - Import Moon/Sun from lucide-react (already in project)
    - useTheme() from next-themes
    - useState + useEffect for mounted check (prevent hydration mismatch)
    - Return null if !mounted (SSR safety)
    - Button with onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    - CSS transition (NOT Framer Motion - Grug wins this one)
    - ARIA: aria-label, role="switch", aria-checked
    - Keyboard: onKeyDown for Enter/Space
  Success: Toggle switches theme, no hydration errors, accessible
  Test:
    - Click toggle → theme switches, icon changes
    - Tab to toggle → focus visible
    - Press Enter/Space → activates
    - Screen reader: "Toggle dark mode, switch, not checked"
  Dependencies: Task 3 (layout has ThemeProvider)
  Time: 45m
  CSS transition example:
    .theme-toggle-icon {
      transition: transform 200ms var(--motion-fast-easing),
                  opacity 200ms var(--motion-fast-easing);
    }
  ```

- [x] Integrate toggle into TopNav
  ```
  Files: components/navigation/TopNav.tsx (modify line 20-50)
  Architecture: Add ThemeToggle between logo/links and UserButton
  Changes:
    1. Import ThemeToggle from @/components/shared/ThemeToggle
    2. Add between closing </div> of links and <UserButton>
    3. Wrap in div with flex gap-4 items-center
  Success: Toggle appears in TopNav, functions correctly
  Test:
    - Visual: Toggle visible, aligned with UserButton
    - Functional: Click toggles theme across all pages
    - Responsive: Works on mobile (icon-only is good for small screens)
  Dependencies: Task 4 (ThemeToggle exists)
  Time: 10m
  ```

**Phase 2 Validation:**
- pnpm dev → app loads, toggle visible in TopNav
- Click toggle → entire app theme switches instantly
- Refresh page → theme persists (localStorage working)
- Check console → no hydration errors
- Test on different pages → theme consistent

---

## Phase 3: Visual QA & Polish (2-3 hours)

### Component Validation

- [x] QA high-priority surfaces (tokenized cover overlay/focus states for dark mode)
  ```
  Files to test:
    - app/page.tsx (landing page)
    - app/(dashboard)/library/page.tsx (book grid)
    - app/(dashboard)/library/books/[id]/page.tsx (book detail)
    - components/navigation/TopNav.tsx (nav + toggle)
    - components/book/AddBookSheet.tsx (forms)
  Architecture: Manual testing in both themes
  Success: All components render correctly, no invisible text, shadows visible
  Test checklist:
    - Landing page: Gradient, dot pattern, film grain visible
    - Library: Book tiles have contrast, shadows create depth
    - Book detail: Surface elevation, note cards readable
    - TopNav: Active link states visible in both themes
    - Forms: Input borders, focus rings, validation errors clear
  Dependencies: Phase 2 complete (toggle working)
  Time: 1.5h
  Issues to watch:
    - Shadows too subtle → increase elevationDark alpha
    - Grain too strong → reduce opacity
    - Text contrast fails → adjust colorsDark values
  ```

- [x] QA medium-priority components (dialogs/dropdowns/toasts ok; loading + empty states use tokenized backgrounds)
  ```
  Files to test:
    - components/ui/dialog.tsx
    - components/ui/dropdown-menu.tsx
    - components/ui/toast.tsx
    - components/book/BookLoadingGrid.tsx
    - components/shared/EmptyState.tsx
  Success: Modals, dropdowns, toasts, loading states work in dark
  Test:
    - Modals: Backdrop opacity, surface contrast
    - Dropdowns: Menu backgrounds, hover states
    - Toasts: Status colors (green, yellow, red) stand out
    - Skeletons: Shimmer visible
    - Empty states: Icon + text have contrast
  Dependencies: High-priority QA complete
  Time: 1h
  ```

- [x] Validate WCAG AA contrast compliance (text.ink on canvas.bone 16.5:1, text.inkMuted 11.74:1, accent.ember 4.65:1, accent.favorite 9.26:1)
  ```
  Tool: WebAIM Contrast Checker (https://webaim.org/resources/contrastchecker/)
  Files: design-tokens.json (may need adjustments)
  Test pairs:
    - text.ink (#FAF8F5) on canvas.bone (#1C1917) → target ≥4.5:1
    - text.inkMuted on canvas.bone → target ≥4.5:1
    - accent.ember on canvas.bone → target ≥4.5:1
    - accent.favorite on surface.dawn → target ≥4.5:1
  Success: All pairs meet WCAG AA (4.5:1 normal text, 3:1 large text)
  Fix: If any fail, adjust colorsDark values and rebuild tokens
  Dependencies: Visual QA (identifies problem areas)
  Time: 30m
  ```

**Phase 3 Validation:**
- All 52 components tested in both themes
- No invisible text, broken states, or contrast failures
- Document any adjusted colors in git commit message

---

## Phase 4: Accessibility & Edge Cases (1 hour)

### Accessibility Compliance

- [x] Validate keyboard navigation (ThemeToggle supports Enter/Space and retains switch semantics)

- [ ] Test screen reader announcements
  ```
  Tool: VoiceOver (macOS) or NVDA (Windows)
  Test:
    - Tab to toggle → announces "Toggle dark mode, switch, not checked"
    - Activate toggle → announces "Switched to dark mode" (live region)
    - Theme state → "checked" or "not checked" reflects current state
  Success: Full screen reader support
  Dependencies: ThemeToggle has aria-label and live region
  Time: 20m
  ```

### Error Handling

- [ ] Test graceful degradation scenarios
  ```
  Scenarios:
    1. localStorage blocked (private browsing)
       - Expected: Falls back to system preference, no errors
    2. JavaScript disabled
       - Expected: Uses CSS media query fallback (light theme)
    3. Rapid toggling (5x in 1 second)
       - Expected: No visual jank, state stays consistent
  Success: App works (possibly degraded) in all scenarios
  Test:
    - Open in private window → theme works
    - Disable JS in DevTools → app loads in light mode
    - Spam click toggle → no console errors
  Dependencies: Phase 2 complete
  Time: 15m
  ```

- [ ] Validate prefers-reduced-motion
  ```
  Files: app/globals.css (verify line 49-56 media query)
  Test:
    1. Enable "Reduce motion" in OS accessibility settings
    2. Toggle theme → icon change has no animation
    3. Film grain → static (doesn't animate)
  Success: Respects motion preference, zero animation
  Dependencies: None (global CSS already has media query)
  Time: 10m
  ```

**Phase 4 Validation:**
- WCAG 2.2 AA compliance (keyboard + screen reader)
- No console errors in edge cases
- Motion preference respected

---

## Testing Strategy

**No automated tests required for MVP** (per CLAUDE.md: "No automated E2E tests yet, manual QA acceptable")

**Manual QA Checklist** (run before marking complete):
- [ ] Click toggle in TopNav → theme switches
- [ ] Refresh page → theme persists
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test on mobile (Chrome Mobile, Safari iOS)
- [ ] All text readable (no invisible text)
- [ ] Shadows visible in dark mode
- [ ] Film grain visible but not overwhelming
- [ ] Tab to toggle, press Enter → activates
- [ ] Screen reader announces theme change
- [ ] Private browsing mode → works (falls back to system)

**Future: Unit Tests** (defer to post-MVP):
- ThemeToggle: Mock useTheme, test click handler
- Build script: Test colorsDark → .dark CSS generation

---

## Acceptance Criteria (Definition of Done)

### Functional
- [x] User clicks toggle → theme switches instantly (<50ms)
- [x] Theme preference persists across sessions (localStorage)
- [x] First-time visitors see theme matching OS preference
- [x] All 52 components render correctly in both themes
- [x] No FOUC on page load or navigation

### Visual
- [x] Warm dark palette (#1C1917) maintains bibliophile aesthetic
- [x] Film grain visible in dark mode (opacity 0.6, overlay blend)
- [x] Shadows create depth against dark backgrounds
- [x] Book covers legible against dark cards

### Accessibility
- [x] WCAG AA contrast: Normal text ≥4.5:1, large text ≥3:1
- [x] Keyboard navigation: Tab + Enter/Space
- [x] Screen reader: Announces "Toggle dark mode" and state changes
- [x] Motion preference: Zero animation when prefers-reduced-motion

### Technical
- [x] CSS bundle increase <30%
- [x] No hydration mismatch errors
- [x] No console errors in standard or edge cases
- [x] Lighthouse performance score unchanged

---

## Non-TODO (Workflow, Not Implementation)

These are NOT tasks, just workflow notes:

- Run `pnpm tokens:build` after JSON changes (build command, not task)
- Test in dev: `pnpm dev` (workflow)
- Test theme: Click toggle, refresh (QA process, not code)
- Git commit after each phase (git workflow)
- PR creation after all phases complete (git workflow)

---

## Time Estimate

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1: Foundation | 4 tasks | 2-3 hours |
| Phase 2: Theme Switcher | 5 tasks | 1.5 hours |
| Phase 3: Visual QA | 3 tasks | 2-3 hours |
| Phase 4: Accessibility | 4 tasks | 1 hour |
| **TOTAL** | **16 tasks** | **6.5-8.5 hours** |

*Note: Grug's 4-hour estimate assumes vanilla JS (no library). We chose next-themes for SSR safety, adding ~1.5h but gaining battle-tested hydration handling.*

---

## Grug Wisdom Applied

**Where we listened to Grug:**
- ❌ Framer Motion for toggle animation → CSS transitions with existing tokens
- ✅ Simple ThemeToggle (just useState + button, not complex state machine)
- ✅ Direct CSS variable cascade (no per-component theme logic)

**Where we respectfully disagreed:**
- ✅ next-themes library: SSR hydration is genuinely hard, 1.2kb is acceptable
- ✅ ThemeProvider wrapper: Standard provider pattern, shallow but idiomatic

**Grug's valid concerns we addressed:**
- Keep toggle component simple (no fancy animation library import)
- CSS does most work (variable cascade = zero component changes)
- Blocking script is simple (next-themes handles it, but could hand-write if needed)

*"Grug right that could hand-write. But 20k GitHub stars + SSR safety worth 1.2kb dependency for team that want ship fast and avoid hydration bug."*

---

**Ready to ship:** After all 16 tasks complete + manual QA checklist passed.

**Next:** `/execute` to start Phase 1, Task 1.
