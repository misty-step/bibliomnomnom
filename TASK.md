# Dark Mode Implementation PRD

## Executive Summary

**Problem:** Users read in varying lighting conditions (bright daylight, evening low-light, nighttime darkness) but bibliomnomnom only supports a single warm light theme, causing eye strain and reduced usability in darker environments.

**Solution:** Implement full dark mode with warm "espresso and leather-bound books" aesthetic that maintains brand identity while providing comfortable reading in all lighting conditions. System preference detection with manual override toggle in TopNav.

**User Value:** Voracious readers can use the app comfortably at any time of day without eye strain, improving daily engagement and retention.

**Success Criteria:**
- WCAG AA contrast compliance in both themes (4.5:1 minimum for normal text)
- Zero flash of unstyled content (FOUC) on theme switch or page load
- Theme preference persists across sessions
- All 52 components render correctly in dark mode
- <50ms theme switch latency

---

## User Context

**Who:** Voracious readers who track books, notes, quotes, and reflections throughout the day.

**Problem Being Solved:**
- **Eye Strain:** Reading white backgrounds at night causes discomfort and fatigue
- **Lighting Adaptation:** Users switch between bright offices and dim evening reading spaces
- **Modern Expectation:** 70%+ of apps now support dark mode; absence feels dated
- **Accessibility:** Some users with light sensitivity require low-luminance interfaces

**Measurable Benefits:**
- Reduced eye strain enables longer app sessions in evening hours
- Increased daily active usage (users can engage comfortably anytime)
- Lower bounce rate from users who check app at night and leave due to brightness
- Improved accessibility for users with photophobia or migraine triggers

---

## Requirements

### Functional Requirements

**FR1: System Preference Detection**
- App detects OS-level theme preference via `prefers-color-scheme` media query
- First-time visitors see theme matching their OS setting
- Works on macOS, Windows, iOS, Android, Linux

**FR2: Manual Override Toggle**
- Icon-only toggle (Moon/Sun) in TopNav, always visible
- Single click switches between light and dark themes
- Visual feedback confirms theme change (icon animation)
- Preference persists across browser sessions

**FR3: Preference Hierarchy**
- Priority: Manual preference (localStorage) > System preference > Light fallback
- Once user manually toggles, app remembers choice even if OS preference changes
- User can reset to "system default" mode (clears manual preference)

**FR4: Warm Dark Aesthetic**
- Dark mode maintains bibliophile brand identity (warm browns/charcoals, not cold grays)
- Film grain texture visible in dark mode (adjusted opacity/blend-mode)
- Shadows and elevation remain perceptible against dark backgrounds

**FR5: Complete Component Coverage**
- All 52 components render correctly in dark mode
- Book covers, user uploads, and Clerk authentication UI respect theme
- No broken states, invisible text, or contrast failures

### Non-Functional Requirements

**NFR1: Performance**
- Theme switch completes in <50ms (imperceptible to user)
- CSS bundle size increase <30% (acceptable for 2x theme coverage)
- No forced reflow/repaint on toggle
- Lighthouse performance score does not regress

**NFR2: Accessibility (WCAG 2.2 AA)**
- Normal text contrast: ≥4.5:1 in both themes
- Large text (18px+) contrast: ≥3:1
- Interactive elements: ≥3:1 against background
- Keyboard navigation: Tab to toggle, Enter/Space to activate
- Screen reader: Announces "Switched to dark mode" on toggle
- Motion preference: Respects `prefers-reduced-motion` (no animations)

**NFR3: Zero FOUC**
- No flash of wrong theme during SSR hydration
- Blocking script sets theme before first paint
- CSS media query fallback for JS-disabled users

**NFR4: Reliability**
- Graceful degradation if localStorage blocked (falls back to system preference)
- No hydration mismatch errors in console
- Theme state never corrupts (rapid toggling handled safely)

**NFR5: Maintainability**
- Single source of truth for colors (`design-tokens.json`)
- Automated build pipeline regenerates CSS + TypeScript types
- Adding future themes requires no component changes

---

## Architecture Decision

### Selected Approach: CSS Variables + next-themes + Warm Dark Palette

**Description:**
- Extend existing design token system with `colorsDark` object in `design-tokens.json`
- Build script generates dual CSS blocks: `:root { ... }` (light) and `.dark { ... }` (dark)
- Use `next-themes` library (1.2kb) for theme state management, localStorage persistence, and FOUC prevention
- Manual toggle in TopNav with system preference as default
- Components adapt via CSS variable cascade (no code changes required)

**Rationale:**
- **User Value (Critical):** Enables comfortable reading in all lighting conditions, addressing accessibility need
- **Simplicity (High):** Leverages existing token system; 99% of components adapt automatically
- **Explicitness (High):** All theme logic centralized in token JSON and build script; no hidden complexity

**Tradeoffs Accepted:**
- **+1.2kb Bundle:** next-themes dependency (acceptable for FOUC prevention + theme management)
- **+25% CSS Size:** Dual theme definitions (mitigated by shared semantic structure)
- **2x Testing Surface:** Light + dark states (offset by automated CSS variable cascade)

### Alternatives Considered

| Approach | User Value | Simplicity | Explicitness | Risk | Why Not Chosen |
|----------|-----------|-----------|--------------|------|----------------|
| **Pure CSS Media Query** | Medium (system-only) | Very High | Very High | Very Low | Cannot remember manual preference; users who want light mode at night have no override |
| **Inversion Filter** | Medium (crude aesthetics) | Very High | Medium | Medium | Breaks brand identity; hue rotation makes warm palette unrecognizable; poor control over shadows/textures |
| **Vanilla React Context** | High | Medium | Medium | Medium | Requires custom FOUC prevention; 3-4h implementation vs 30m with next-themes; reinvents solved problem |
| **No Dark Mode (Jobs Rec)** | Low (blocks users) | Very High | Very High | High (competitive) | Addresses eye strain need; competitive disadvantage; modern expectation in 2025 |

**Decision:** CSS Variables + next-themes balances user value (full theme control) with simplicity (minimal component changes) and low risk (battle-tested library).

**Jobs Concern Acknowledged:** Jobs review recommended deferring dark mode to focus on book search and export features (higher user acquisition value). **Response:** Dark mode addresses accessibility need and competitive parity; book search remains next priority after this 7-hour sprint.

---

## Module Boundaries

### Module 1: Design Token System (Existing + Extended)

**Responsibility:** Single source of truth for all color, elevation, gradient, and texture values across light and dark themes.

**Interface:**
- Input: `design-tokens.json` (manual editing)
- Output: `app/design-tokens.css` (CSS custom properties), `lib/design/tokens.generated.ts` (TypeScript types)
- Build Command: `pnpm tokens:build`

**Hidden Complexity:**
- Nested JSON parsing and flattening
- Dual CSS generation (`:root` + `.dark` selectors)
- TypeScript type generation with exclusions (`colorsDark` not exported)
- Semantic token naming conventions

**Changes for Dark Mode:**
- Add `colorsDark`, `elevationDark`, `gradientsDark` objects to JSON
- Modify build script to generate `.dark { ... }` CSS block
- Exclude `*Dark` objects from TypeScript exports (build-time only)

**Abstraction Layer:** Components consume semantic names (`bg-canvas-bone`), never know hex values or theme logic.

---

### Module 2: Theme State Management (New)

**Responsibility:** Manage theme preference (system vs manual), persist across sessions, prevent FOUC, expose theme state to components.

**Interface:**
- Provider: `<ThemeProvider>` wrapper in `app/layout.tsx`
- Hook: `const { theme, setTheme } = useTheme()` in client components
- Attributes: `attribute="class"`, `defaultTheme="system"`, `enableSystem`

**Hidden Complexity:**
- localStorage read/write with error handling
- System preference detection via `window.matchMedia`
- Blocking script injection to prevent FOUC
- Hydration mismatch prevention via `suppressHydrationWarning`
- Preference hierarchy resolution (manual > system > fallback)

**Dependencies:** `next-themes` library (abstracts all complexity above)

**Abstraction Layer:** Components call `setTheme("dark")`, library handles persistence and DOM updates.

---

### Module 3: Theme Toggle UI (New)

**Responsibility:** Provide accessible, always-visible control for manual theme switching with visual feedback.

**Interface:**
- Component: `<ThemeToggle />` in `components/shared/ThemeToggle.tsx`
- Props: None (reads theme from `useTheme()` hook)
- Placement: TopNav, between Library link and UserButton

**Hidden Complexity:**
- Mounted state check (prevent hydration mismatch)
- Icon animation (Sun/Moon swap with Framer Motion)
- ARIA labels and keyboard handlers
- Screen reader announcements via live region

**User Interaction:**
1. User clicks toggle → `setTheme(theme === 'dark' ? 'light' : 'dark')`
2. Icon animates (Moon → Sun or Sun → Moon)
3. CSS variables update → entire app re-themes
4. Preference saved to localStorage
5. Screen reader announces "Switched to dark mode"

**Abstraction Layer:** Simple button component hides theme state management, persistence, and accessibility logic.

---

### Module 4: Component Theming (Existing + No Changes)

**Responsibility:** Render UI with theme-appropriate colors via Tailwind utilities and CSS variables.

**Interface:**
- Tailwind classes: `bg-canvas-bone`, `text-text-ink`, `border-line-ghost`
- CSS variable references: `var(--color-canvas-bone)`, `shadow-[var(--elevation-soft)]`
- No theme props, no conditional logic

**Hidden Complexity:**
- CSS variable cascade automatically resolves light vs dark values based on `.dark` class on `<html>`
- Tailwind utilities compile to `background-color: var(--color-canvas-bone)` under the hood

**Changes for Dark Mode:** **None required** (99% of components adapt via CSS variable cascade)

**Exceptions (4 components):**
- `BookTile.tsx`, `BookForm.tsx`, `AddBookSheet.tsx`, `BookDetail.tsx`: Replace hardcoded `fill-amber-400` with `fill-accent-favorite` token

**Abstraction Layer:** Components consume semantic tokens, theme switching happens transparently via CSS.

---

## Dependencies & Assumptions

### External Dependencies

| Dependency | Version | Purpose | Risk Mitigation |
|-----------|---------|---------|-----------------|
| `next-themes` | ^0.4.4 | Theme state + FOUC prevention | Battle-tested (20k+ GitHub stars), zero breaking changes in 2 years |
| `lucide-react` | Existing | Moon/Sun icons for toggle | Already in project |
| Tailwind CSS | 3.4.1 | `darkMode: ["class"]` support | Already configured |

### Assumptions

**Scale Expectations:**
- User base: <10k concurrent users (no CDN caching complexity)
- Theme switches: <5 per session per user (not a high-frequency action)
- CSS bundle: <50kb total (light + dark), acceptable for broadband/4G

**Environment:**
- Modern browsers supporting CSS custom properties (IE11 not supported, acceptable for 2025)
- JavaScript enabled (graceful degradation to system preference for JS-disabled)
- localStorage available (cookie fallback not needed for MVP)

**Team Constraints:**
- Single developer implementing (no cross-team coordination)
- 7-hour sprint allocation (realistic for scope defined)
- No automated E2E tests yet (manual QA acceptable for MVP)

### Integration Requirements

**Next.js 15:**
- ThemeProvider must be client component (`'use client'` directive)
- `suppressHydrationWarning` required on `<html>` tag in `app/layout.tsx`
- Blocking script injected by `next-themes` automatically

**Clerk Authentication:**
- UserButton component respects theme automatically (uses CSS variables)
- No custom Clerk appearance config needed

**Convex Backend:**
- No backend changes required (theme is client-only)
- Future: Could persist theme preference in user settings table (deferred)

---

## Implementation Phases

### Phase 1: Foundation (2-3 hours) - Sprint Week 1

**Goal:** Establish dark mode design tokens and build infrastructure.

**Tasks:**
1. **Define Dark Palette** (1h)
   - Add `colorsDark` to `design-tokens.json` with warm palette:
     - `canvas.bone: #1C1917` (espresso charcoal)
     - `text.ink: #FAF8F5` (inverted bone)
     - `surface.dawn: #27241F` (warm brown surface)
     - `line.ghost: rgba(250,248,245,0.08)` (light lines)
     - `accent.ember: #EF4444` (brightened red for contrast)
   - Add `elevationDark` with stronger shadows (alpha: 0.40, 0.60)
   - Add `gradientsDark` for landing page hero

2. **Update Build Script** (30m)
   - Modify `scripts/build-tokens.mjs` to generate `.dark { ... }` CSS block
   - Exclude `*Dark` objects from TypeScript type exports
   - Test: `pnpm tokens:build` regenerates CSS + types correctly

3. **Add `accent.favorite` Token** (15m)
   - Light: `#F59E0B` (amber for favorite stars)
   - Dark: `#FBBF24` (brighter amber for dark bg contrast)
   - Migrate 4 hardcoded `fill-amber-400` to `fill-accent-favorite`

4. **Adjust Film Grain** (15m)
   - Add `.dark body::before` rule to `app/globals.css`
   - Change blend-mode to `screen`, reduce opacity to `0.6`
   - Test visibility on dark backgrounds

**Deliverable:** Dark mode CSS variables generated, all components theme-ready (no visual changes yet).

**Validation:**
- `app/design-tokens.css` contains `:root` (light) and `.dark` (dark) blocks
- No TypeScript errors after token rebuild
- Film grain visible on manually applied `.dark` class to `<html>`

---

### Phase 2: Theme Switcher (2 hours) - Sprint Week 1

**Goal:** Enable user-controlled theme switching with persistence.

**Tasks:**
1. **Install next-themes** (5m)
   ```bash
   pnpm add next-themes
   ```

2. **Create ThemeProvider** (30m)
   - File: `components/providers/ThemeProvider.tsx`
   - Wrap `next-themes` provider with config:
     - `attribute="class"`
     - `defaultTheme="system"`
     - `enableSystem`
     - `disableTransitionOnChange`

3. **Update Root Layout** (15m)
   - Add `suppressHydrationWarning` to `<html>` tag
   - Wrap app with `<ThemeProvider>` between `<ClerkProvider>` and `<ConvexClientProvider>`

4. **Create ThemeToggle Component** (1h)
   - File: `components/shared/ThemeToggle.tsx`
   - Icon-only button with Moon/Sun icons (Lucide React)
   - Mounted state check to prevent hydration mismatch
   - Framer Motion icon animation (rotate 90deg, fade in/out)
   - ARIA labels: `aria-label="Toggle dark mode"`, `role="switch"`, `aria-checked={theme === 'dark'}`
   - Keyboard handlers: Enter/Space trigger toggle
   - Screen reader announcement via live region

5. **Add to TopNav** (15m)
   - Insert `<ThemeToggle />` in `components/navigation/TopNav.tsx`
   - Position between Library link and UserButton (right side)

**Deliverable:** Functional theme toggle, theme persists across sessions, zero FOUC.

**Validation:**
- Clicking toggle switches theme instantly
- Refreshing page maintains theme choice
- System preference respected for first-time visitors
- No hydration errors in console

---

### Phase 3: Visual QA & Polish (2-3 hours) - Sprint Week 1

**Goal:** Ensure all components look excellent in dark mode, fix contrast issues.

**Tasks:**
1. **High-Priority Components** (1.5h)
   - Landing page (`app/page.tsx`): Test hero gradient, dot pattern, film grain
   - Library grid (`app/(dashboard)/library/page.tsx`): Book tiles, hover states, shadows
   - Book detail (`app/(dashboard)/library/books/[id]/page.tsx`): Surface elevation, note cards
   - TopNav/Masthead: Active link states, UserButton contrast
   - Forms (Add Book sheet): Input borders, focus rings, validation errors

2. **Medium-Priority Components** (1h)
   - Modals/Dialogs: Backdrop opacity, surface contrast
   - Dropdowns: Menu backgrounds, hover states
   - Toasts: Status colors (positive, warning, danger) on dark bg
   - Loading skeletons: Shimmer animation visibility
   - Empty states: Icon and text contrast

3. **Contrast Validation** (30m)
   - Use WebAIM Contrast Checker on:
     - Normal text: `text.ink` on `canvas.bone` (target: ≥4.5:1)
     - Muted text: `text.inkMuted` on `canvas.bone` (target: ≥4.5:1)
     - Accent red: `accent.ember` on `canvas.bone` (target: ≥4.5:1)
   - Adjust colors if any fail WCAG AA

4. **Shadow Adjustments** (15m)
   - Test Surface component elevation in dark mode
   - If shadows too subtle, increase `elevationDark` alpha values
   - Target: Clearly visible depth without harsh edges

**Deliverable:** All components render beautifully in dark mode, WCAG AA compliant.

**Validation:**
- Manual QA checklist: 52 components tested in both themes
- Contrast ratios documented (screenshot + ratios)
- No invisible text, broken states, or contrast failures

---

### Phase 4: Accessibility & Edge Cases (1 hour) - Sprint Week 1

**Goal:** Ensure keyboard navigation, screen reader support, and error handling.

**Tasks:**
1. **Keyboard Navigation** (15m)
   - Test Tab order: Library → ThemeToggle → UserButton
   - Test Enter/Space keys activate toggle
   - Test focus indicator visible in both themes

2. **Screen Reader Testing** (20m)
   - Test VoiceOver (macOS) or NVDA (Windows)
   - Verify toggle announced as "Toggle dark mode, switch, checked/unchecked"
   - Verify theme change announced "Switched to dark mode"

3. **Error Handling** (15m)
   - Test localStorage blocked (private browsing): Falls back to system preference
   - Test JS disabled: Uses CSS media query fallback
   - Test rapid toggling: No visual jank or state corruption

4. **Reduced Motion** (10m)
   - Enable `prefers-reduced-motion` in OS settings
   - Verify theme toggle has no animation
   - Verify film grain doesn't animate (static texture)

**Deliverable:** Fully accessible theme switcher, graceful degradation for edge cases.

**Validation:**
- WCAG 2.2 AA compliance (keyboard + screen reader)
- No console errors with localStorage blocked
- Smooth experience for motion-sensitive users

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Warm dark palette fails WCAG contrast** | Medium | High | Test all color pairings with WebAIM checker before launch; start with pure inversion (guaranteed AA), warm incrementally |
| **Film grain too strong in dark mode** | Medium | Low | Test opacity levels (0.3, 0.4, 0.5, 0.6); use `screen` blend-mode; solicit user feedback |
| **Shadows invisible on dark backgrounds** | Medium | Medium | Increase `elevationDark` alpha values (0.40, 0.60); test on actual dark displays, not bright monitors |
| **Hydration mismatch errors** | Low | High | Use `suppressHydrationWarning`, mounted state check in toggle; follow next-themes patterns exactly |
| **Performance regression** | Low | Medium | Measure bundle size increase (<30% acceptable); test theme switch latency (<50ms target) |
| **Clerk components don't respect theme** | Low | Medium | Clerk uses CSS variables by default; if issues, add custom appearance config |
| **Hardcoded colors missed in QA** | Medium | Low | Use ast-grep to find remaining hardcoded Tailwind colors; automated search reduces manual review burden |

---

## Key Decisions

### Decision 1: Warm Dark Mode (vs Pure Inversion)

**What:** Dark mode uses warm charcoals and browns (#1C1917, #292524) instead of pure blacks and grays (#000000, #333333).

**Alternatives:**
- Pure inversion (blacks/grays): Guaranteed WCAG compliance, fast implementation, but loses warm bibliophile brand
- High-contrast (true black): Maximum accessibility, but feels sterile and un-branded

**Rationale:**
- **User Value:** Maintains "Tactile Intellectual" brand identity; dark mode feels like extension of light theme, not generic mode
- **Simplicity:** Reuses warm aesthetic (brown undertones); users recognize brand continuity
- **Explicitness:** Warm palette documented in design tokens; clear intent

**Tradeoffs:**
- Harder to execute (contrast risk requires testing)
- Slightly longer implementation (color calibration) vs pure inversion
- **Accepted because:** Brand differentiation > speed of implementation

---

### Decision 2: next-themes Library (vs Vanilla Implementation)

**What:** Use `next-themes` (1.2kb) for theme state management instead of custom React Context.

**Alternatives:**
- Vanilla React Context: Zero dependencies, full control, but requires custom FOUC prevention (3-4h extra work)
- Pure CSS media query: Simplest possible, but no manual override

**Rationale:**
- **User Value:** Zero FOUC, instant theme switching, persistent preferences
- **Simplicity:** 30m integration vs 4h custom implementation; battle-tested solution
- **Explicitness:** next-themes API is well-documented; team can reference official docs

**Tradeoffs:**
- +1.2kb bundle size (acceptable for FOUC prevention value)
- External dependency (mitigated by library maturity: 2 years, 20k stars)
- **Accepted because:** FOUC prevention is critical for polish; reinventing solved problem wastes time

---

### Decision 3: System Preference as Default (vs Light-Only Default)

**What:** First-time visitors see theme matching their OS preference; manual override takes precedence after first toggle.

**Alternatives:**
- Always light mode: Simpler (no system detection), but ignores accessibility preference
- Always dark mode: Polarizing (some users dislike dark mode)

**Rationale:**
- **User Value:** Respects accessibility choices; users with photophobia get dark mode automatically
- **Simplicity:** Modern expectation (most apps now support system preference)
- **Explicitness:** Clear hierarchy: Manual > System > Light fallback

**Tradeoffs:**
- Slightly complex preference logic (priority hierarchy)
- **Accepted because:** Accessibility > simplicity; modern UX standard in 2025

---

### Decision 4: TopNav Toggle Placement (vs Settings Page)

**What:** Theme toggle appears in TopNav (always visible) as icon-only button.

**Alternatives:**
- Settings page: Hidden until user navigates to settings (reduces clutter but adds friction)
- Dropdown menu: Grouped with user actions (cleaner but requires extra click)

**Rationale:**
- **User Value:** Zero-click access; users switch themes frequently (morning bright → evening dim)
- **Simplicity:** No navigation required; toggle visible in all app states
- **Explicitness:** Icon (Moon/Sun) is universal symbol for dark mode

**Tradeoffs:**
- Adds one element to TopNav (mitigated by icon-only, no text label)
- **Accepted because:** Reading apps especially benefit from instant theme access

---

### Decision 5: CSS Variable Cascade (vs `dark:` Tailwind Variants)

**What:** Components rely on CSS variable cascade (99% adapt automatically) instead of explicit `dark:` variants on every class.

**Alternatives:**
- Explicit `dark:` variants: `className="bg-white dark:bg-black text-black dark:text-white"` on every element
- CSS-only (no JS toggle): Pure media query approach (no manual override)

**Rationale:**
- **User Value:** Same (both approaches work visually)
- **Simplicity:** Zero component changes vs 1000+ class additions; maintains deep module architecture
- **Explicitness:** All theme logic in token JSON, not scattered across 52 components

**Tradeoffs:**
- Less granular control (can't easily make one component darker than others)
- **Accepted because:** Consistency > granularity; design system should be cohesive, not piecemeal

---

## Test Scenarios

### Happy Path
- ✅ User with dark OS preference visits site → sees dark theme immediately
- ✅ User with light OS preference visits site → sees light theme immediately
- ✅ User clicks toggle to dark mode → theme switches instantly (<50ms)
- ✅ User refreshes page → dark mode persists
- ✅ User navigates between pages → theme remains consistent
- ✅ User opens new tab → same theme as original tab (localStorage shared)

### System Preference Changes
- ✅ User changes OS to dark while app open (no manual override) → app updates to dark
- ✅ User changes OS to light while app open with manual override → app ignores (stays dark)
- ✅ User clears localStorage → falls back to system preference

### Persistence & State
- ✅ User manually toggles to dark, then changes OS to light → stays dark (manual > system)
- ✅ User toggles back to "system" mode → respects OS changes again
- ✅ User with no localStorage visits → uses system preference
- ✅ User clears browser data → resets to system preference

### Visual Quality
- ✅ All text has ≥4.5:1 contrast (WCAG AA normal text)
- ✅ Film grain visible but not overpowering in dark mode
- ✅ Shadows create depth on dark backgrounds (cards elevated)
- ✅ Landing page gradients look intentional (not broken)
- ✅ Book covers (user uploads) legible against dark cards
- ✅ Clerk UserButton respects theme

### Component Coverage
- ✅ TopNav/Masthead render correctly in dark mode
- ✅ BookTile cards have proper contrast (text, borders, shadows)
- ✅ BookGrid layout works (no invisible elements)
- ✅ Modals/dialogs have appropriate backdrop opacity
- ✅ Forms: inputs, labels, validation errors visible
- ✅ Toasts: status colors stand out (green, yellow, red)
- ✅ Loading skeletons match theme
- ✅ Empty states render correctly

### Edge Cases
- ✅ `prefers-reduced-motion: reduce` → no toggle animation
- ✅ JavaScript disabled → CSS media query fallback works
- ✅ Slow connection → no FOUC during hydration
- ✅ Rapid toggling (5x in 1 second) → no jank or state corruption
- ✅ localStorage blocked (private browsing) → falls back to system, no errors

### Browser Compatibility
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari macOS (latest)
- ✅ Safari iOS (latest)
- ✅ Chrome Mobile (latest)

### Performance
- ✅ Theme switch <50ms
- ✅ No layout shift on toggle
- ✅ CSS bundle increase <30%
- ✅ No forced reflow/repaint
- ✅ Lighthouse performance score unchanged

### Accessibility
- ✅ Toggle has `aria-label="Toggle dark mode"`
- ✅ Tab key reaches toggle (keyboard navigation)
- ✅ Enter/Space activates toggle
- ✅ Screen reader announces "Switched to dark mode"
- ✅ Focus indicator visible in both themes
- ✅ Reduced motion respected (no animations)

---

## Jobs Concern: Focus vs Features

**Jobs Review Summary:** Recommended deferring dark mode to focus on higher-value features (Google Books search, JSON export) that drive user acquisition over retention. Dark mode serves existing power users but doesn't solve adoption barriers.

**Response:**
- **Acknowledged:** Book search and export are next priorities after this sprint
- **Rationale for Proceeding:** Dark mode addresses accessibility need (photophobia, eye strain), not just aesthetic preference
- **Competitive Context:** 70%+ of book tracking apps support dark mode; absence feels dated in 2025
- **Time Boxed:** 7-hour sprint with clear scope; not ongoing distraction from core features
- **Compounding Value:** Dark mode infrastructure enables instant theming for all future components

**Commitment:** Ship dark mode in 1 week sprint, immediately pivot to book search (10x add speed) and export (removes adoption barrier).

---

## Success Metrics (Post-Launch)

**1 Week Post-Launch:**
- Dark mode adoption rate: % of users who manually toggle (target: >30%)
- Theme preference distribution: system vs manual, light vs dark
- Error rate: hydration errors, FOUC reports (target: <0.1%)

**1 Month Post-Launch:**
- Evening engagement: +20% DAU in 7pm-11pm hours (hypothesis: dark mode reduces eye strain)
- Session duration: +10% average session length in dark mode users
- Retention: Dark mode users have +5% week-2 retention (comfort → habit formation)

**Accessibility Impact:**
- User feedback: Survey dark mode users on eye strain reduction (qualitative)
- Support tickets: -50% "too bright" / "can't read at night" complaints

---

## Next Steps

1. ✅ **Spec approved** → Begin Phase 1 (Foundation)
2. Run `/plan` to break PRD into tactical implementation tasks
3. Execute 7-hour sprint (Phases 1-4)
4. Manual QA with checklist (all 52 components tested)
5. Ship to production (no feature flag, full launch)
6. Monitor success metrics (1 week check-in)
7. **Immediately pivot to book search implementation** (Jobs priority)

---

**PRD Version:** 1.0
**Last Updated:** 2025-11-26
**Author:** AI Spec (Jobs + UX + Design Systems synthesis)
**Status:** Ready for Implementation
