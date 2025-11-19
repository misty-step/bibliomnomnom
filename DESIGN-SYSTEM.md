# bibliomnomnom Design System v1.0

## Philosophy

**Radical Simplicity**: This design system has been stripped to its essential core. Every element serves a purpose. No decoration for decoration's sake.

**Monochrome Foundation**: The entire interface is built on a warm, bibliophile palette of bone (cream) and ink (near-black). No electric blues, no purple gradients, no unnecessary color complexity.

**Editorial Precision**: Typography-first design inspired by quality book publishing and literary magazines.

---

## Color Palette

### Canvas
- **Bone** `#F6F1E5` - Primary background (aged paper aesthetic)
- **Bone Muted** `#ECE2D1` - Secondary surfaces

### Text
- **Ink** `#0F1115` - Primary text
- **Ink Muted** `#4B5563` - Secondary text
- **Ink Subtle** `#7F8897` - Tertiary text

### Surface
- **Dawn** `#FDF8EF` - Elevated surfaces (cards, modals)

### Line
- **Ghost** `rgba(15,17,21,0.08)` - Subtle borders
- **Ember** `rgba(15,17,21,0.15)` - Defined borders

### Status
- **Positive** `#46D549` - Success states
- **Warning** `#FFB347` - Warning states
- **Danger** `#FF4D4F` - Error states

### What We Removed
❌ Electric blue (#2F6BFF)
❌ Orchid purple (#A86BFF)
❌ Sunset orange (#FF8A5C)
❌ All gradients (sky-dawn, azure-orchid, twilight)
❌ Glass/frosted effects
❌ Dark theme variants

---

## Typography

### Font Stack
```css
--font-display: "Canela", "Times New Roman", serif
--font-sans: "Söhne", "Neue Montreal", system-ui, sans-serif
--font-mono: "JetBrains Mono", "IBM Plex Mono", monospace
```

**Key Decision**: Removed Inter from fallback stack (overused in modern web design).

### Scale
- **Display** (headings): 48px, 32px, 24px
- **Body**: 16px, 14px
- **Mono** (metadata): 12px uppercase with 0.25em tracking

### Usage
- **Canela (display)**: Large headlines, book titles, page headers
- **Söhne (sans)**: All body copy, UI text, descriptions
- **JetBrains Mono**: Metadata labels, status badges, technical information

---

## Spacing

Simplified from 14 tokens to 9 core values:

```
3xs: 0.25rem (4px)
2xs: 0.375rem (6px)
xs: 0.5rem (8px)
sm: 0.75rem (12px)
md: 1rem (16px)
lg: 1.5rem (24px)
xl: 2rem (32px)
2xl: 3rem (48px)
3xl: 4rem (64px)
```

**What We Removed**: Semantic aliases like `heroInset`, `coverColumn`, `notePanel` (YAGNI).

---

## Elevation (Shadows)

3 levels only:

```
flat: none
soft: 0 4px 16px rgba(12,22,38,0.06)
raised: 0 8px 24px rgba(5,8,16,0.12)
```

**What We Removed**: `overlay` shadow level (unnecessary complexity).

---

## Border Radius

3 values:

```
sm: 0.5rem (8px)
md: 0.75rem (12px)
lg: 1rem (16px)
```

**What We Removed**: `xs` and `pill` variants.

---

## Motion

2 timing functions:

```
fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
base: 300ms cubic-bezier(0.16, 0.84, 0.44, 1)
```

**What We Removed**: `snappy`, `drift`, `pulse` variants (just two is enough).

### Motion Utilities

```css
.motion-fade-in       /* Page entrance animation */
.motion-hover-lift    /* Interactive element hover */
```

**Accessibility**: All animations respect `prefers-reduced-motion: reduce`.

---

## Components

### Surface

**Purpose**: Universal container primitive.

**Props**:
- `elevation`: `flat | soft | raised`
- `padding`: `none | sm | md | lg | xl`
- `interactive`: boolean (adds hover/focus states)

**What We Removed**:
- ❌ `tone` prop (6 variants → always `dawn`)
- ❌ `texture` prop (cloud/matrix/grain complexity)
- ❌ Glass/night/twilight variants

**Usage**:
```tsx
<Surface elevation="soft" padding="md">
  Content here
</Surface>
```

---

### Button

**Purpose**: All clickable actions.

**Variants**: 2 only
- `primary`: Ink background, dawn text (default)
- `ghost`: Transparent, subtle hover

**Sizes**: `sm | md | lg`

**What We Removed**:
- ❌ `primary-electric` (electric blue)
- ❌ `secondary-bone`
- ❌ `subtle-glass`
- ❌ `ghost-ink` (now just `ghost`)
- ❌ `icon` variant

**Usage**:
```tsx
<Button variant="primary" size="md">Sign in</Button>
<Button variant="ghost">Cancel</Button>
```

---

### What We Deleted

**Components removed entirely**:
- ❌ TextureOverlay (atmospheric complexity)
- ❌ SplitBillboard (complex marketing hero)
- ❌ MetricCard / HeroStatPanel (premature analytics)
- ❌ InsightsSection (nice-to-have, not core)
- ❌ AssetImage / asset management system
- ❌ AuthLayout (simplified to centered Clerk components)
- ❌ PublicBookView (social features deferred)

---

## Core Flows

### 3 Perfect Flows (Everything Else Deferred)

1. **Library View** `/library`
   - Clean book grid
   - Beautiful empty state
   - Add Book button
   - Smooth animations

2. **Add Book Modal**
   - Gorgeous form
   - Clear validation
   - Cover upload
   - Success feedback

3. **Book Detail + Notes** `/library/books/[id]`
   - Hero with cover
   - Reading metadata
   - Simple note editor
   - Delete confirmation

---

## What We Deferred

📦 Book status filters (want-to-read, currently-reading, read)
📦 Privacy toggles (all private by default)
📦 Favorites system
📦 Insights/metrics dashboard
📦 Public book profiles
📦 Book import functionality
📦 Texture overlays
📦 Marketing homepage (replaced with minimal landing)

---

## Design Decisions

### Why Monochrome?

The electric blue + purple gradient was **generic AI aesthetic** - overused in SaaS products and indistinguishable from countless other apps. By committing to monochrome (bone + ink), we create a distinctive bibliophile sanctuary that aligns with the core reading experience.

### Why Remove Textures?

The texture system (cloud/matrix/grain) was sophisticated but **premature optimization**. We can add atmospheric effects later if needed. Start simple, add complexity only when it serves a clear purpose.

### Why 2 Button Variants?

Every additional variant is a decision developers must make. Primary (call-to-action) and ghost (secondary) cover 95% of use cases. More variants = more complexity = slower development.

### Why Remove Inter?

Inter is the most overused sans-serif in modern web design. By removing it from the fallback stack, we're making a subtle but important statement: we're not following generic defaults.

---

## Implementation Status

### ✅ Completed
- Design tokens simplified (62 lines, down from 99)
- Color palette reduced to monochrome + status colors
- Surface component (2 elevation variants)
- Button component (2 variants)
- Minimal landing page
- Simplified auth pages
- Library page structure

### 🚧 In Progress
- Fix remaining TextureOverlay references
- Update tailwind.config.ts for simplified tokens
- Clean up legacy color classes (bg-paper → bg-canvas-bone)

### 📋 Next
- Perfect Library grid view
- Perfect Add Book modal
- Perfect Book Detail + Notes
- Add keyboard escape to modals
- Structured error messages
- Optimistic UI updates

---

## Usage Examples

### Page Structure
```tsx
<section className="motion-fade-in space-y-8 px-4 py-8">
  <h1 className="font-display text-4xl tracking-tight text-text-ink">
    Your Library
  </h1>
  <p className="text-text-ink-muted">
    Every book you're reading.
  </p>
</section>
```

### Card Layout
```tsx
<Surface elevation="soft" padding="md" className="space-y-4">
  <h2 className="font-display text-2xl text-text-ink">Book Title</h2>
  <p className="text-text-ink-muted">Author Name</p>
</Surface>
```

### Button Group
```tsx
<div className="flex gap-3">
  <Button variant="primary">Save</Button>
  <Button variant="ghost">Cancel</Button>
</div>
```

---

## Migration Guide

### Old → New

**Colors**:
- `bg-paper` → `bg-canvas-bone`
- `bg-paper-secondary` → `bg-canvas-bone-muted`
- `text-ink` → `text-text-ink`
- `text-ink-faded` → `text-text-ink-muted`
- `text-leather` → `text-text-ink` (no more accent colors)
- `bg-action-electric` → `bg-text-ink`

**Components**:
- `<Surface tone="bone">` → `<Surface>` (tone removed)
- `<Button variant="primary-electric">` → `<Button variant="primary">`
- `<Button variant="ghost-ink">` → `<Button variant="ghost">`
- `<TextureOverlay />` → Remove entirely

**Motion**:
- `motion-page` → `motion-fade-in`
- `duration-snappy` → `duration-fast`
- `duration-drift` → `duration-base`

---

## Future Considerations

When the app grows beyond 3 core flows, we may need:
- One accent color (warm amber or monochrome only)
- Layout primitives (Stack, Center, Container)
- More button variants (but justify each one)
- Dark mode (bone → night, ink → dawn)

**Principle**: Add complexity only when simplicity becomes a constraint.

---

*Last Updated: 2025-01-13*
*Status: Foundation established, implementation in progress*
*Philosophy: Radically simple, editorially precise, bibliophile-first*
