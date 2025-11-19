# DESIGN.md — Bibliomnomnom Visual System

> Goal: Every surface should feel like a “luminous reading lab.” Calm bone canvas, electric focal cues, nectar warmth, dreamy halftone skies.

## 1. Token Source of Truth
- All visual primitives live in `design-tokens.json` → `pnpm tokens:build` → `app/design-tokens.css` + `lib/design/tokens.generated.ts`.
- Never declare raw hex, rgb, or px in components. ESLint rule `design-tokens/no-raw-design-values` enforces this.
- Tailwind pulls directly from generated tokens (`tailwind.config.ts`). If a value is missing, add it to the JSON first.

## 2. Color Roles (HSL/Hex live in token file)
| Token | Intent | Emotional cue | Usage |
| --- | --- | --- | --- |
| `colors.canvas.bone` | Primary background | quiet parchment | Page backgrounds, modals, nav rails. |
| `colors.canvas.boneMuted` | Secondary surface | depth layering | Cards sitting on bone backgrounds, skeleton shimmer. |
| `colors.canvas.night` | Nightfall backdrop | mystery, depth | Dark hero overlays, twilight gradients. |
| `colors.text.ink` | Base body text | clarity | Default copy. |
| `colors.text.inkMuted` | Secondary text | calm guidance | Captions, helper text. |
| `colors.text.inkSubtle` | Disabled/inactive | restraint | Placeholder text, quiet metadata. |
| `colors.action.electric` | Primary CTA | intelligent glow | Buttons, links, focus rings. |
| `colors.action.electricMuted` | Hover/secondary CTA | friendly hand-off | Button hover/focus backgrounds. |
| `colors.accent.orchid` | Ambient gradient | curious twilight | Hero gradients, stats highlight. |
| `colors.accent.nectar` | Warm success | human warmth | Success banners, positive pills. |
| `colors.accent.sunset` | Alert warmth | friction | Warning pills, leather legacy references. |
| `colors.line.ghost` | Subtle border | soft structure | Default hairlines and dividers. |
| `colors.line.ember` | Emphasis border | tactile | Input outlines, glass edges. |
| `colors.status.*` | Semantic statuses | clarity | Positive/warning/danger badges. |

**Electric vs Nectar:** Use electric when drawing attention to an action or data point requiring focus. Use nectar when reinforcing human storytelling moments (success toast, curated recommendation) or when a gradient needs warmth injected. Never pair nectar with destructive context; fall back to sunset/danger tokens.

## 3. Gradients & Textures
- `gradients["sky-dawn"]`: hero skyline (electric → orchid → nectar). Apply to hero backgrounds or CTA halos.
- `gradients["azure-orchid"]`: compact CTA backgrounds, stat highlight bars.
- `gradients["twilight"]`: dark overlays behind photography.
- Textures (cloud, matrix, grain) mask halftone overlays. Use `TextureOverlay` helper once implemented; never inline the gradient string.

## 4. Typography Scale
| Token | Font Stack | Usage |
| --- | --- | --- |
| `typography.display` | Canela → Times | Hero headlines, large numbers (≥ 40px). |
| `typography.sans` | Söhne → Neue Montreal/Inter | Body copy, UI text. |
| `typography.mono` | JetBrains Mono | Metadata labels, tokens, uppercase pills.

Baseline rhythm: 1.2 modular scale. Headline sizes should stay on-scale (e.g., 48, 32, 24, 20, 16) and align to `line-height: 1.2` for display, `1.4` for sans.

## 5. Spacing Ladder
Semantic spacing tokens map to `--space-*` variables. Core ladder: `3xs` (0.25rem) up to `3xl` (4rem). Specialized aliases:
- `heroInset` (1.25rem): top/bottom padding for hero wrappers.
- `coverColumn` (12.5rem): width for book cover columns in responsive grids.
- `notePanel` (15.625rem): minimum note editor height.
- `formFieldMin` (6rem): description textarea min height.
- `toastMax` (26.25rem): max toast viewport width.
Use these semantic names inside `min-h-[var(--space-note-panel)]` or similar—never reintroduce raw pixel values.

## 6. Radius & Elevation
- Radii tokens (`xs` 0.35rem → `pill`). Choose the smallest that achieves intent: `xs` for pills, `md` for cards, `lg` for hero shells.
- Elevation tokens: `soft` (resting cards), `raised` (hovered cards, floating CTA), `overlay` (modals). Each token encapsulates color + blur; reference via `tokenVars.elevation.*` for JS-based libs.
- Glass tokens: `frosted` (hero glass) and `panel` (nav rail) feed `backdrop-filter` utilities.

## 7. Motion Tokens
| Token | Duration | Curve | Intent |
| --- | --- | --- | --- |
| `motion.snappy` | 180ms | `(0.4, 0, 0.2, 1)` | Buttons, micro hover transitions. |
| `motion.drift` | 420ms | `(0.16, 0.84, 0.44, 1)` | Hero background shifts, nav indicator glides. |
| `motion.pulse` | 900ms | `(0.37, 0, 0.63, 1)` | Ambient glow, stat number rolls.
Always wrap animations with `prefers-reduced-motion` fallbacks; tokens live in CSS custom properties for use in JS frameworks (Framer Motion, etc.).

## 8. Usage Checklist
1. Import `app/design-tokens.css` before any component-level styles (already handled in `app/globals.css`).
2. Tailwind utilities automatically map semantically; when building custom CSS, reference `var(--color-*)` tokens.
3. For JS animation libraries, read from `tokenVars` (e.g., `tokenVars.elevation.raised`).
4. ESLint rule blocks regressions; if a value is missing add it to `design-tokens.json`, rerun `pnpm tokens:build`, update this doc.

## 9. Visual QA
- Contrast: verify Electric on Bone and Ink on Bone meet 4.5:1.
- Motion: ensure we degrade to opacity/fade for reduced motion.
- Textures: apply at ≤ 20% opacity; aim for subtlety.
- Photography: grayscale assets should sit atop `gradients.twilight` overlays to avoid pure black banding.

Maintaining this contract keeps modules deep: surfaces + layout components only need semantic props, never literal color codes. EOF
