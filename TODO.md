# TODO: Editorial Continuity Redesign

Transform bibliomnomnom from "generic SaaS dashboard" to "premium editorial experience." The landing page establishes the aesthetic: asymmetric typography, dot pattern texture, filled buttons, Canela display font. Now we propagate that throughout the app.

---

## Phase 1: Foundation

### Global Texture & Background

- [x] Add dot pattern texture overlay to `app/(dashboard)/layout.tsx`. Use the exact same SVG pattern from landing page: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%231C1917'/%3E%3C/svg%3E")` at `opacity-25`. Apply as absolute positioned div covering the layout. This creates immediate visual continuity with landing. Success: every dashboard page has visible dot texture.

- [x] Add radial gradient background to `app/(dashboard)/layout.tsx`. Match landing: `radial-gradient(circle at 30% 40%, var(--color-canvas-bone) 0%, var(--color-canvas-bone-muted) 100%)`. Layer behind the dot texture. Success: subtle warmth gradient visible on all dashboard pages.

### Masthead Component

- [x] Create `components/navigation/Masthead.tsx` to replace TopNav. Simple horizontal bar: logo left ("bibliomnomnom" in Canela 2rem), user avatar right (Clerk UserButton). No navigation links in masthead—those move to Spine. No tagline (that's landing-only). Height: ~80px with generous padding. Background: transparent (texture shows through). Success: clean masthead that echoes landing typography.

- [ ] Remove navigation links (LIBRARY, SETTINGS) from the masthead. These will live in the new Spine component. The masthead is purely logo + user identity.

### Spine Component (Left Sidebar Navigation)

- [x] Create `components/navigation/Spine.tsx` as fixed left sidebar. Width: 200px. Contains: navigation links at top, stats in middle, separated by 1px horizontal rules using `border-line-ember`. Position fixed, full height, left edge. Background: transparent (texture shows through). This replaces both TopNav links and StatsBar.

- [x] Implement navigation links in Spine as text links (not buttons). Style: `font-mono text-sm uppercase tracking-widest`. Active state: `text-ink` with underline. Inactive: `text-inkMuted` no underline. Links: "LIBRARY" and "SETTINGS". Underline animation: width 0→100% on hover (150ms). Success: magazine table-of-contents feel.

- [x] Implement stats display in Spine below navigation. Display vertically: "12 read", "3 reading", "8 want", then separator, then "23 total". Numbers in Canela display font (2rem), labels in mono (0.75rem, muted). This makes numbers design elements, not data. Query books data using `useAuthedQuery(api.books.list)`. Success: stats feel like editorial design, not dashboard metrics.

- [ ] Add horizontal rule separators in Spine using `<hr className="border-line-ember" />`. One below nav links, one above total count. Creates visual rhythm and structure.

### Layout Integration

- [x] Update `app/(dashboard)/layout.tsx` to use new Masthead and Spine. Structure: Masthead at top (full width), then flex container with Spine (fixed 200px) and main content area. Main content needs `ml-[200px]` on desktop to account for fixed Spine. Remove existing TopNav and StatsBar imports/usage.

- [x] Add padding to main content area in layout. Should be `px-8 md:px-16 lg:px-24 py-12`. Content should not touch edges. Max-width: none (let asymmetry breathe). Success: generous whitespace like landing page.

### Button Style Standardization

- [x] Audit all Button component usages across codebase and ensure filled style. The pattern: `bg-text-ink text-canvas-bone hover:bg-text-inkMuted`. No ghost/outline variants in the app (landing established filled as the style). Files to check: AddBookModal, BookDetail, any other button usages.

- [x] Update `components/ui/button.tsx` default variant to be filled ink style. Remove or deprecate outline/ghost variants if they exist. Ensure consistent padding: `px-8 py-3`. Success: every button in app matches landing page button.

---

## Phase 2: Library Page

### Page Layout & Typography

- [x] Redesign `app/(dashboard)/library/page.tsx` with asymmetric layout. Content should occupy ~70% width, leaving ~15% right margin as whitespace. Left-align everything. Add "LIBRARY" page title in Canela 4rem at top, followed by horizontal rule (1px `border-line-ember`). This mirrors landing structure.

- [x] Move "Add Book" button/trigger above filter tabs, left-aligned. Change from button to text link style: "+ Add Book" with plus prefix. Uses `font-sans text-base text-ink hover:text-inkMuted` with underline on hover. Success: less visual weight, more editorial.

### Filter Tabs Redesign

- [x] Replace pill-style filter tabs with text links in `components/book/BookGrid.tsx` (or wherever filters live). Format: "Currently Reading · Read · Want to Read · Favorites · All". Separated by middot `·`. Active state: regular weight with underline. Inactive: muted color, no underline. Use `font-mono text-sm uppercase tracking-wider`. Success: magazine navigation feel, not UI kit pills.

- [x] Implement underline animation on filter tab hover. Use pseudo-element `::after` with `transform: scaleX(0)` → `scaleX(1)` on hover. Origin left. Duration 150ms ease-out. Active tab has permanent underline.

### Book Grid Refinement

- [x] Update `components/book/BookGrid.tsx` to left-align grid, not center. Remove any `justify-center` or `mx-auto` that centers the grid. Grid should start from left edge of content area. Gap between items: `gap-8` (2rem). Columns: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.

- [x] Simplify `components/book/BookTile.tsx` by removing card chrome. No border, no shadow, no background. Just: cover image, then title + author text below. Cover should have subtle `rounded-lg` but no border. Hover effect: `transform: translateY(-2px)` with `transition-transform duration-150`. Success: books are the visual, not the containers.

- [x] Update book tile typography. Title: `font-display text-base` (Canela). Author: `font-sans text-sm text-inkMuted`. Both left-aligned under cover. Line clamp title to 2 lines, author to 1.

### Add Book Side Sheet

- [x] Create `components/ui/SideSheet.tsx` generic component. Slides in from right edge of viewport. Props: `isOpen`, `onClose`, `children`, `title`. Width: 400px. Full viewport height. Uses `position: fixed`, `right: 0`, `top: 0`. Animation: `transform: translateX(100%)` → `translateX(0)` over 300ms ease-out. Background: `bg-canvas-bone`. Left edge shadow: `shadow-[-8px_0_24px_rgba(0,0,0,0.1)]`.

- [x] Add backdrop overlay to SideSheet. When open, render div behind sheet with `bg-text-ink/50` (50% opacity ink). Click on backdrop closes sheet. Fade in 200ms.

- [x] Convert `components/book/AddBookModal.tsx` to use SideSheet instead of modal. Rename to `AddBookSheet.tsx`. Same form content but in sheet format. Header: "ADD BOOK" in mono uppercase small, with horizontal rule below.

- [x] Restyle form inputs in AddBookSheet. Remove visible borders, use bottom-border only that appears on focus. Style: `border-b border-transparent focus:border-line-ember`. Generous padding: `py-3`. Labels: mono, uppercase, small, muted (`font-mono text-xs uppercase tracking-wider text-inkMuted`).

- [x] Replace radio buttons for status selection with text links. Format: "Want to Read · Reading · Read". Active has underline, others muted. Store selection in state, submit with form. Same interaction pattern as filter tabs. Success: consistent editorial interaction model.

### Empty State

- [x] Update empty state in library (when no books in category). Left-align, not centered. First line: "Your reading list awaits." in Canela 1.5rem. Second line: "+ Add your first book" as text link. Position where first book card would appear (top-left of grid area), not centered in void.

---

## Phase 3: Book Detail Page

### Two-Column Layout

- [x] Restructure `components/book/BookDetail.tsx` with asymmetric two-column layout. Desktop: Cover column 35% width (left), Details column 50% (right), remaining 15% is whitespace margin. Use CSS Grid: `grid-template-columns: 35% 50% 1fr`. Mobile: stack vertically. Success: spread layout like magazine feature.

- [x] Position cover image in left column. Large, takes full column width. Aspect ratio 2:3 for books. Below cover: "Upload new cover" as small text link (`text-sm text-inkMuted hover:text-ink hover:underline`). No card container around cover section.

### Title & Metadata

- [x] Style book title in Canela 3rem, left-aligned in details column. Author below in sans 1.25rem, `text-inkMuted`. Add horizontal rule below author (1px `border-line-ember`, width 100% of details column). This creates the same visual rhythm as landing page title treatment.

- [x] Display reading status as text, not dropdown. Show current status (e.g., "Read") in sans 1rem. Below it, show date in small muted text (e.g., "Finished December 2024"). Make the status text clickable to reveal inline dropdown for changing.

- [x] Create inline status dropdown that appears on click. Not a native select—custom styled dropdown that appears below the status text. Options styled as text links with same hover/active pattern. Positioned absolutely below trigger. Close on selection or click outside.

### Actions as Text Links

- [x] Convert Favorite toggle to text link. Display "★ Favorite" if favorited, "☆ Add to favorites" if not. Click toggles state. Style: `text-sm text-ink hover:text-inkMuted`. No button chrome. Unicode stars are intentional—they're typographic elements.

- [x] Convert Privacy toggle to text link. Display "Private" or "Public" with appropriate icon/emoji prefix. Click opens a small confirmation popover or toggles directly. No card container around it. Style same as favorite link.

- [x] Remove all card containers and nested boxes from BookDetail. The content should flow directly—no "Upload cover" card, no "Privacy" card. These become simple text links with proper spacing (mb-4 between items). Success: flat hierarchy, no visual nesting.

### Notes Section

- [x] Redesign Notes section header. "NOTES" in mono, small, uppercase, tracking-wider. Horizontal rule below. Left-aligned in details column. Generous top margin to separate from book metadata.

- [x] Simplify `components/notes/NoteEditor.tsx` styling. Remove heavy borders. Use subtle border that only appears on focus. Reduce visual weight. Textarea should feel like writing in a margin, not filling out a form.

- [x] Convert note type selector (Note/Quote/Reflection) to text links with middot separators. Same pattern as filters and status selector. Active type underlined, others muted. Replace any toggle/radio UI.

- [x] Simplify `components/notes/NoteList.tsx` note cards. Remove heavy borders and shadows. Use only subtle top border (`border-t border-line-ghost`) to separate notes. Note content should breathe—generous padding, clean typography.

---

## Phase 4: Polish & Responsive

### Micro-interactions

- [x] Add page content fade-in animation. Content fades in over 200ms on page load. Use Framer Motion `initial={{ opacity: 0 }}` → `animate={{ opacity: 1 }}`. Texture background does not animate (always visible).

- [x] Add stagger animation for page elements. Title appears first, then rule (100ms delay), then content (200ms delay). Use Framer Motion `transition={{ delay: 0.1 }}` etc. Subtle, not dramatic.

- [x] Implement link underline hover animation globally. Use CSS: `::after` pseudo-element, `transform: scaleX(0)` → `scaleX(1)` on hover, `transform-origin: left`, `transition: transform 150ms ease-out`. Apply to all text links (nav, filters, actions).

### Responsive Behavior

- [x] Make Spine collapsible on tablet (768px-1199px). Spine becomes horizontal bar below masthead with nav links inline and stats as compact horizontal row. Content area gets full width.

- [x] Implement hamburger menu for mobile (<768px). Masthead shows hamburger icon left of logo. Tapping opens overlay with nav links and stats. User avatar stays in masthead.

- [x] Stack book detail layout on tablet/mobile. Cover above details, both full width. Maintain left-alignment throughout. Adjust typography scale down ~20% for mobile.

- [x] Ensure SideSheet becomes full-screen modal on mobile. On screens <768px, sheet takes full viewport width/height instead of 400px. Add close button in top-right.

### Typography Audit

- [x] Audit all pages for typography consistency. Every page title should use Canela display. Every label should use mono small uppercase. Every body text should use sans. No exceptions. Create mental map: "What font goes here?" should be obvious answer.

- [x] Verify all number displays use Canela. Stats in Spine, counts in filters, any other numeric data. Numbers are design elements, not plain text.

### Final QA

- [ ] Test all pages for texture visibility. Dot pattern should be noticeable but subtle on every dashboard page. Adjust opacity if needed (currently 25%).

- [ ] Verify all buttons are filled style. No ghost/outline buttons should remain anywhere in the app.

- [ ] Confirm all text links have underline hover animation. Navigation, filters, actions, "Add Book"—all should animate consistently.

- [ ] Test responsive breakpoints. Desktop (1200px+): full spine + asymmetric layouts. Tablet (768px-1199px): collapsed spine. Mobile (<768px): hamburger menu.

---

## Files to Modify

### Create New
- `components/navigation/Masthead.tsx`
- `components/navigation/Spine.tsx`
- `components/ui/SideSheet.tsx`
- `components/book/AddBookSheet.tsx`

### Major Changes
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/library/page.tsx`
- `components/book/BookDetail.tsx`
- `components/book/BookGrid.tsx`
- `components/book/BookTile.tsx`

### Moderate Changes
- `components/ui/button.tsx`
- `components/notes/NoteEditor.tsx`
- `components/notes/NoteList.tsx`

### Delete
- `components/navigation/TopNav.tsx` (replaced by Masthead)
- `components/navigation/StatsBar.tsx` (moved to Spine)
- `components/book/AddBookModal.tsx` (replaced by AddBookSheet)

---

## Definition of Done

The redesign is complete when:
1. Every dashboard page has dot texture and gradient background
2. Navigation uses Masthead + Spine pattern
3. All interactive elements follow text-link pattern (not buttons) except primary CTAs
4. Book detail page uses two-column asymmetric layout
5. All typography follows the scale (Canela display, sans body, mono labels)
6. All buttons are filled ink style
7. Responsive behavior works at all breakpoints
8. Micro-interactions (fade, stagger, underline) are consistent

The app should feel like opening a beautifully designed magazine about your reading life.
