# TODO: bibliomnomnom MVP Implementation

## Context
- **Architecture**: Convex-First with Actions for External Services (DESIGN.md)
- **Key Files**: See DESIGN.md File Organization (lines 1042-1176)
- **Patterns**: New project following Next.js 14+ App Router, Convex, Clerk, shadcn/ui conventions
- **Module Boundaries**: 5 core modules with clean interfaces (DESIGN.md lines 36-778)

## Foundation Phase

- [x] Initialize Next.js project with TypeScript and App Router
  ```
  Files: package.json, next.config.ts, tsconfig.json, app/layout.tsx, app/page.tsx, .npmrc, README.md
  Architecture: Next.js 15.5.6 with App Router, TypeScript strict mode, pnpm 9.15.0 enforced
  Pseudocode: Manual Next.js setup with TypeScript, Tailwind, App Router, add pnpm enforcement
  Success: ✅ pnpm dev ready, app/ directory created, TypeScript compiles, enforcement configured
  Test: ✅ Project structure verified, pnpm-lock.yaml committed, git commit successful
  Dependencies: None
  Time: 45min
  Work Log:
  - ✅ Decision: pnpm over bun for production stability and Next.js 15 compatibility
  - ✅ Enforcement: only-allow preinstall + packageManager field + engine-strict .npmrc
  - ✅ Created all core files manually for full control over configuration
  - ✅ React 19.2.0, Next.js 15.5.6, TypeScript 5.9.3
  - ✅ pnpm install completed in 7.3s (371 packages)
  - ✅ Committed with descriptive message including architecture decisions
  ```

- [x] Configure Tailwind CSS with bibliophile color palette
  ```
  Files: tailwind.config.ts, app/globals.css, app/page.tsx
  Pattern: Extend Tailwind theme with custom colors and typography
  Reference: TASK.md lines 268-277 (color palette), lines 262-266 (typography)

  Success criteria:
  - ✅ Can use bg-paper, bg-paper-secondary, text-ink, text-ink-faded classes
  - ✅ Can use text-leather, text-leather-light for accents
  - ✅ Can use border-border for subtle borders
  - ✅ Can use font-serif, font-sans, font-mono in components
  - ✅ Can use text-xs through text-6xl (Tailwind defaults)
  - ✅ Home page renders with new colors and fonts
  - ✅ No Tailwind compilation errors
  - ✅ Build passes: 102 kB First Load JS

  Work Log:
  - ✅ Added bibliophile color palette (paper, ink, leather, border)
  - ✅ Added typography fonts (Crimson Text serif, Inter sans, JetBrains Mono)
  - ✅ Applied colors to landing page (warm sepia aesthetic)
  - ✅ Simplified config via code review:
    * Removed duplicate background/foreground CSS vars (10 lines)
    * Removed fontSize override (uses Tailwind defaults, 10 lines)
    * Made border.DEFAULT consistent with other colors
    * Converted body CSS to @apply directive
  - ✅ 30% reduction in config complexity
  - ✅ All classes compile and work correctly

  Time: 35min
  ```

- [x] Install and configure shadcn/ui base components
  ```
  Files: components.json, components/ui/button.tsx, lib/utils.ts
  Architecture: shadcn/ui as component foundation
  Success: ✅ shadcn/ui initialized, button component available, cn() utility works
  Test: ✅ Button renders on home page, build passes (102 kB First Load JS)
  Dependencies: Tailwind configured ✅
  Time: 30min

  Work Log:
  - ✅ Installed shadcn/ui with new-york style, lucide icons
  - ✅ Installed button component only (YAGNI principle)
  - ✅ Mapped shadcn CSS vars to bibliophile HSL values:
    * --primary: 25 77% 31% (leather)
    * --background: 39 36 30 (paper)
    * --foreground: 0 0% 10% (ink)
  - ✅ Removed unused components per code review (dialog, input, toast, toaster, use-toast)
  - ✅ Removed dark mode theme (not in MVP scope) - 26 LOC
  - ✅ Removed chart colors (no charting) - 17 LOC
  - ✅ Simplified to single border color strategy
  - ✅ Total simplification: 550 LOC removed from initial install
  - ✅ Clean integration preserving bibliophile aesthetic
  ```

- [x] Initialize Convex with basic configuration
  ```
  Files: convex/schema.ts, convex/_generated/*, .env.local
  Architecture: Convex as single source of truth for all data
  Success: ✅ Schema deployed, users table created, by_clerk_id index active
  Test: ✅ npx convex dev --once succeeded, connection verified
  Dependencies: Project initialized ✅
  Time: 30min

  Work Log:
  - ✅ Installed convex package (1.28.2)
  - ✅ Created convex/schema.ts with users table
  - ✅ Users table fields: clerkId, email, name?, imageUrl?
  - ✅ Added by_clerk_id index for auth lookups
  - ✅ Deployed schema to groovy-roadrunner-224.convex.cloud
  - ✅ Generated Convex type definitions (_generated/*)
  - ✅ Added CLERK routing env vars to .env.local
  ```

- [x] Integrate Clerk authentication with Next.js middleware
  ```
  Files: app/layout.tsx, middleware.ts, app/ConvexClientProvider.tsx, app/(auth)/sign-in, app/(auth)/sign-up
  Architecture: Clerk for auth, middleware protects routes, sync with Convex (DESIGN.md lines 38-115)
  Success: ✅ Sign-in/sign-up routes work, middleware active, JWT passed to Convex
  Test: ✅ Build passes, middleware 81.7 kB, auth routes 136 kB each
  Dependencies: Next.js and Convex initialized ✅
  Time: 1hr

  Work Log:
  - ✅ Installed @clerk/nextjs (6.34.5), @clerk/clerk-react, convex-helpers
  - ✅ Created middleware.ts with route protection:
    * Public routes: /, /sign-in, /sign-up, /books/*
    * Protected: All other routes require auth
  - ✅ Wrapped app with ClerkProvider in root layout
  - ✅ Created ConvexClientProvider for Convex-Clerk JWT integration
  - ✅ Created sign-in page at app/(auth)/sign-in/[[...sign-in]]/page.tsx
  - ✅ Created sign-up page at app/(auth)/sign-up/[[...sign-up]]/page.tsx
  - ✅ Both pages styled with bg-paper for bibliophile aesthetic
  - ✅ Middleware matcher configured to skip static files
  ```

## Module 1: Authentication & User Management

- [x] Implement Convex user schema and auth helpers
  ```
  Files: convex/auth.ts, convex/users.ts
  Architecture: Module 1 (DESIGN.md lines 38-115), users table with clerk_id index
  Success: ✅ Auth helpers exported, user mutations ready, type-safe
  Test: ✅ Functions deployed, getCurrentUser query works
  Dependencies: Convex initialized ✅
  Time: 45min

  Work Log:
  - ✅ Created convex/auth.ts with requireAuth and getAuthOrNull
  - ✅ Extracted getUserByClerkId helper (DRY - removed duplication)
  - ✅ Created convex/users.ts with getCurrentUser query
  - ✅ Created createOrUpdateUser mutation for Clerk webhook sync
  - ✅ Created deleteUser mutation (idempotent)
  - ✅ Applied simplifications per code review:
    * Removed verbose JSDoc comments (25% LOC reduction)
    * Extracted shared lookup logic
    * Inlined userData object in mutation
    * Early return pattern in deleteUser
  - ✅ Deployed to Convex successfully
  ```

- [x] Create Clerk webhook handler for user sync
  ```
  Files: app/api/webhooks/clerk/route.ts, convex/users.ts
  Architecture: Clerk → Convex user sync via webhook (DESIGN.md lines 81-84)
  Pseudocode: Webhook receives user.created/updated/deleted, calls Convex mutations
  Success: Webhook validates signature, creates/updates/deletes Convex user, responds 200
  Test: Trigger Clerk webhook, verify user created in Convex database
  Dependencies: Convex schema and auth helpers implemented
  Time: 1hr
  ```

- [x] Build auth-protected route layout
  ```
  Files: app/(dashboard)/layout.tsx, app/(auth)/sign-in/[[...sign-in]]/page.tsx, app/(auth)/sign-up/[[...sign-up]]/page.tsx
  Architecture: Route groups for auth and dashboard (DESIGN.md lines 1046-1062)
  Pseudocode: ClerkProvider wraps app, ConvexProviderWithClerk passes JWT, protected layout checks auth
  Success: Sign-in/sign-up pages render, dashboard layout requires auth, navigation works
  Test: Sign up new user, redirect to library, verify session persists
  Dependencies: Clerk integrated, webhook handler implemented
  Time: 1hr
  ```

- [x] Create useAuth client hook
  ```
  Files: lib/hooks/useAuth.ts
  Architecture: Module 1 public interface (DESIGN.md lines 70-74)
  Pseudocode: Wrap useConvexAuth for loading and auth state
  Success: Hook returns isLoading and isAuthenticated, components can use for conditional rendering
  Test: Use in component, verify loading state → authenticated state transition
  Dependencies: Clerk and Convex providers configured
  Time: 15min
  ```

## Module 2: Books Data Layer

- [x] Implement Convex books schema with indexes
  ```
  Files: convex/schema.ts (books table)
  Architecture: Module 2 data structures (DESIGN.md lines 369-417)
  Pseudocode: Books table with userId foreign key, status/favorite/privacy fields, compound indexes
  Success: Books table defined with all fields, three indexes created (by_user, by_user_status, by_user_favorite)
  Test: Insert test book via Convex dashboard, verify indexes work
  Dependencies: User schema implemented
  Time: 45min
  ```

- [x] Create book query functions (list, get, getPublic)
  ```
  Files: convex/books.ts (queries)
  Architecture: Module 2 public interface (DESIGN.md lines 123-194)
  Pseudocode: Privacy-aware retrieval (Algorithm 3, lines 883-931), index-based queries, ownership filtering
  Success: Three query functions exported, privacy filtering works, public books sanitized
  Test: Query user's books, verify privacy enforcement, test public book access
  Dependencies: Books schema and auth helpers implemented
  Time: 1.5hr
  ```

- [x] Create book mutation functions (create, update, remove)
  ```
  Files: convex/books.ts (mutations)
  Architecture: Module 2 CRUD operations (DESIGN.md lines 196-275)
  Pseudocode: Ownership validation, automatic timestamps, cascade deletes for notes
  Success: CRUD mutations work, ownership enforced, timestamps auto-set, notes cascade delete
  Test: Create/update/delete books, verify ownership checks, test cascade delete
  Dependencies: Book queries implemented
  Time: 2hr
  ```

- [x] Create specialized book mutations (updateStatus, toggleFavorite, updatePrivacy)
  ```
  Files: convex/books.ts (specialized mutations)
  Architecture: Module 2 quick operations (DESIGN.md lines 277-352)
  Pseudocode: Auto-dating algorithm (Algorithm 2, lines 823-880), optimistic update pattern (Algorithm 5, lines 1006-1038)
  Success: Status updates auto-set dates, favorite toggles instantly, privacy changes work
  Test: Move book through states, verify dateStarted/dateFinished set, test favorite toggle
  Dependencies: Book CRUD mutations implemented
  Time: 1.5hr
  ```

## Module 3: External Book Search

- [x] Implement Google Books API search action
  ```
  Files: convex/search.ts, .env.local (GOOGLE_BOOKS_API_KEY)
  Architecture: Module 3 (DESIGN.md lines 427-536), Convex actions for external calls
  Pseudocode: Algorithm 4 (lines 935-1002), transform Google Books response to SearchResult format
  Success: Search action returns transformed results, API key hidden, errors handled gracefully
  Test: Search "Thinking Fast and Slow", verify 10 results returned with metadata
  Dependencies: Convex initialized, environment variables configured
  Time: 1.5hr
  ```

- [ ] Create search modal with real-time results
  ```
  Files: components/search/SearchModal.tsx, components/search/SearchBar.tsx, components/search/SearchResults.tsx
  Architecture: Search UI (DESIGN.md lines 1102-1105), debounced search pattern (lines 1888-1899)
  Pseudocode: Debounce input, call search action, display grid of results, click to add
  Success: Modal opens, search debounced 500ms, results display with covers, add button works
  Test: Type query, verify debounce, see results render, click add
  Dependencies: Search action implemented, shadcn dialog component installed
  Time: 2hr
  ```

## Module 4: Notes & Content

- [ ] Implement Convex notes schema with indexes
  ```
  Files: convex/schema.ts (notes table)
  Architecture: Module 4 data structures (DESIGN.md lines 646-665)
  Pseudocode: Notes table with bookId/userId foreign keys, type enum, markdown content
  Success: Notes table defined, indexes created (by_book, by_user), types validated
  Test: Insert test note via dashboard, verify indexes work
  Dependencies: Books schema implemented
  Time: 30min
  ```

- [ ] Create note query and mutation functions
  ```
  Files: convex/notes.ts
  Architecture: Module 4 public interface (DESIGN.md lines 544-632)
  Pseudocode: Ownership validation via book relationship, CRUD operations, chronological ordering
  Success: List/create/update/delete notes, ownership enforced via book, sorted by date
  Test: Create notes for book, verify ownership check, test CRUD operations
  Dependencies: Notes schema and book queries implemented
  Time: 1.5hr
  ```

- [ ] Build rich text note editor component
  ```
  Files: components/notes/NoteEditor.tsx, components/notes/NoteTypeSelector.tsx
  Architecture: Note editor UI (DESIGN.md lines 1096-1100), rich text with Tiptap
  Pseudocode: Tiptap editor with markdown support, type selector (note/quote/reflection), auto-save
  Success: Editor supports formatting, type selector works, debounced auto-save, page number optional
  Test: Create note, format text, switch types, verify auto-save triggers
  Dependencies: Note mutations implemented
  Time: 2.5hr
  ```

- [ ] Create note display components
  ```
  Files: components/notes/NoteList.tsx, components/notes/NoteCard.tsx
  Architecture: Note display UI (DESIGN.md lines 1097-1100)
  Pseudocode: List notes chronologically, display type badge, render markdown, edit/delete actions
  Success: Notes display in order, markdown renders, type badges show, actions work
  Test: Display notes for book, verify ordering, test edit/delete
  Dependencies: Note editor implemented
  Time: 1.5hr
  ```

## Module 5: File Upload (Custom Covers)

- [ ] Implement Vercel Blob upload API route
  ```
  Files: app/api/blob/upload/route.ts, .env.local (BLOB_READ_WRITE_TOKEN)
  Architecture: Module 5 (DESIGN.md lines 675-776), presigned URL pattern
  Pseudocode: Client-side upload flow (lines 716-738), validate user auth, generate presigned URL, restrict file types/size
  Success: API route generates presigned URL, validates user auth, enforces 5MB limit and image types
  Test: POST to route with auth, receive presigned URL, verify validation
  Dependencies: Clerk authentication implemented
  Time: 1hr
  ```

- [ ] Create cover upload component
  ```
  Files: components/book/UploadCover.tsx
  Architecture: Client-side Blob upload (DESIGN.md lines 716-738)
  Pseudocode: File input, upload to Blob with progress, save URL to Convex, display preview
  Success: Upload shows progress, completes within 3s for 5MB, URL saved to book, cover displays
  Test: Upload cover image, verify progress bar, see cover update instantly
  Dependencies: Blob API route and book update mutation implemented
  Time: 1.5hr
  ```

## UI Components & Pages

- [ ] Build library grid view with filtering
  ```
  Files: app/(dashboard)/library/page.tsx, components/book/BookGrid.tsx, components/book/BookCard.tsx
  Architecture: Library view (DESIGN.md lines 1056-1058), filter by status/favorites
  Pseudocode: Query books with filters, grid layout, book cards with hover effects, status badges
  Success: Books display in grid, filters work, hover animations smooth, real-time updates
  Test: Add book, see appear instantly, filter by status, verify favorites filter
  Dependencies: Book queries implemented
  Time: 2.5hr
  ```

- [ ] Create book detail page with tabs
  ```
  Files: app/(dashboard)/books/[id]/page.tsx, components/book/BookDetail.tsx
  Architecture: Private book detail (DESIGN.md lines 1059-1060)
  Pseudocode: Fetch book, verify ownership, tabs for overview/notes/quotes/reflections, actions (favorite, privacy, status)
  Success: Book details display, ownership enforced, tabs switch smoothly, actions update optimistically
  Test: View book, switch tabs, toggle favorite, change status
  Dependencies: Book queries and note components implemented
  Time: 2.5hr
  ```

- [ ] Build public book page
  ```
  Files: app/books/[id]/page.tsx
  Architecture: Public book view (DESIGN.md lines 1064-1065, privacy algorithm lines 883-931)
  Pseudocode: Fetch public book (no auth), display sanitized data, show public notes, hide private fields
  Success: Public books accessible without auth, private books return 404, data sanitized
  Test: Make book public, visit /books/[id] in incognito, verify access
  Dependencies: getPublic query implemented
  Time: 1.5hr
  ```

- [ ] Create book form and add book modal
  ```
  Files: components/book/BookForm.tsx, components/search/SearchModal.tsx integration
  Architecture: Add/edit book UI (DESIGN.md lines 1091), manual entry fallback
  Pseudocode: Search modal → select result OR manual form, create book with defaults, success toast
  Success: Can add via search or manual entry, form validation works, book created with correct defaults
  Test: Search and add, manually add book, verify both paths work
  Dependencies: Search modal and book create mutation implemented
  Time: 2hr
  ```

- [ ] Implement status badge and privacy toggle components
  ```
  Files: components/book/StatusBadge.tsx, components/book/PrivacyToggle.tsx
  Architecture: Visual indicators (DESIGN.md lines 1092-1093)
  Pseudocode: Status badge with colors (want-to-read/currently-reading/read), privacy toggle with confirmation
  Success: Badges styled beautifully, privacy toggle shows confirmation modal, updates optimistically
  Test: View different statuses, toggle privacy, verify confirmation
  Dependencies: Book mutation functions implemented
  Time: 1hr
  ```

## Layout & Navigation

- [ ] Build dashboard layout with navigation
  ```
  Files: app/(dashboard)/layout.tsx
  Architecture: Persistent dashboard layout (DESIGN.md lines 1054)
  Pseudocode: Sidebar or top nav, user avatar, links (library, settings), sign out
  Success: Layout wraps all dashboard pages, navigation works, user info displays
  Test: Navigate between pages, verify layout persists, sign out works
  Dependencies: Auth implemented
  Time: 1.5hr
  ```

- [ ] Create loading states and error boundaries
  ```
  Files: components/shared/LoadingSkeleton.tsx, components/shared/ErrorBoundary.tsx, app/(dashboard)/library/loading.tsx
  Architecture: Loading and error handling (DESIGN.md lines 1107-1110)
  Pseudocode: Skeleton screens during query loading, error boundary for component errors, fallback UI
  Success: Skeletons show during loading, errors caught gracefully, fallback UI renders
  Test: Slow network simulation, trigger error, verify fallbacks
  Dependencies: UI components built
  Time: 1.5hr
  ```

- [ ] Implement empty states
  ```
  Files: components/shared/EmptyState.tsx
  Architecture: No data placeholder (DESIGN.md line 1109)
  Pseudocode: Illustration + message + CTA for empty library, no notes, no search results
  Success: Beautiful empty states with helpful CTAs, contextual messages
  Test: View empty library, book with no notes, failed search
  Dependencies: UI foundation built
  Time: 1hr
  ```

## Polish & Testing

- [ ] Add Framer Motion animations
  ```
  Files: components/book/BookCard.tsx, components/shared/* (wrap with motion)
  Architecture: Subtle animations (DESIGN.md lines 287-293)
  Pseudocode: Page transitions (fade), card hover (lift + shadow), state changes (smooth color), micro-celebrations
  Success: Animations smooth (60fps), not jarring, enhance UX, can be disabled for reduced motion
  Test: Hover cards, navigate pages, change book status, verify smoothness
  Dependencies: UI components built
  Time: 2hr
  ```

- [ ] Implement responsive design breakpoints
  ```
  Files: All component files, tailwind.config.ts
  Architecture: Responsive breakpoints 640/768/1024/1280 (DESIGN.md line 298)
  Pseudocode: Mobile-first Tailwind classes, test at each breakpoint, adjust grid columns and spacing
  Success: Works beautifully at all sizes, touch targets 44px minimum on mobile, readable on all screens
  Test: Test on iPhone, iPad, desktop screens, verify usability
  Dependencies: All UI components built
  Time: 2.5hr
  ```

- [ ] Create toast notification system
  ```
  Files: components/ui/toast.tsx (shadcn), lib/hooks/useToast.ts
  Architecture: User feedback (DESIGN.md error handling and success states)
  Pseudocode: shadcn toast, success/error/info variants, auto-dismiss, accessible
  Success: Toasts appear on actions, auto-dismiss after 5s, accessible, beautiful
  Test: Trigger various actions, verify toasts appear and dismiss
  Dependencies: shadcn/ui installed
  Time: 30min
  ```

- [ ] Set up environment variables and configuration
  ```
  Files: .env.local, .env.example, next.config.js
  Architecture: Environment setup (DESIGN.md lines 1323-1344)
  Pseudocode: All required keys documented in .env.example, Next.js config for images/blob
  Success: All env vars documented, .env.example complete, config allows remote images
  Test: Copy .env.example to .env.local, verify app starts
  Dependencies: All features implemented
  Time: 30min
  ```

## Deployment Preparation

- [ ] Optimize images and assets
  ```
  Files: next.config.js, public/*, components with images
  Architecture: Performance considerations (DESIGN.md lines 1829-1899)
  Pseudocode: Next.js Image component, WebP format, lazy loading, CDN via Vercel
  Success: Images optimized, lazy loaded, LCP < 1s, Lighthouse score > 90
  Test: Run Lighthouse, verify image optimization
  Dependencies: All UI built
  Time: 1hr
  ```

- [ ] Verify security implementation
  ```
  Files: convex/* (all query/mutation files), middleware.ts, app/api/blob/upload/route.ts
  Architecture: Security considerations (DESIGN.md lines 1939-2032)
  Pseudocode: Audit ownership checks, privacy filtering, input validation, auth enforcement
  Success: No data leakage possible, all mutations validate ownership, inputs validated, API keys hidden
  Test: Attempt unauthorized access, inject malicious input, verify rejections
  Dependencies: All features implemented
  Time: 1.5hr
  ```

- [ ] Create production deployment configuration
  ```
  Files: vercel.json, convex.json (production deployment), README.md
  Architecture: Deployment to Vercel (DESIGN.md lines 2127-2136)
  Pseudocode: Configure Vercel project, connect Convex production, set env vars, deploy
  Success: Deployed to Vercel, Convex production running, all features work in production
  Test: Visit production URL, test all features, verify real-time updates work
  Dependencies: All features complete and tested
  Time: 1hr
  ```

## Post-Implementation Review

After Phase 1 complete:
- Review module boundaries: Are interfaces clean? Any leaky abstractions?
- Identify emerging patterns: Repeated code that should be extracted?
- Performance audit: Any queries slower than 100ms? Mutations slower than 200ms?
- Accessibility check: Keyboard navigation working? Screen reader tested?

After Phase 2 complete:
- Review coupling: Can components be tested independently?
- Privacy audit: Run penetration test on privacy controls
- User testing: Get 5 beta users to test core flows

## Notes

**Module Boundaries to Maintain:**
1. **Auth Module** hides Clerk complexity behind requireAuth()
2. **Books Module** hides database queries behind list/get/create/update
3. **Search Module** hides API complexity behind searchBooks action
4. **Notes Module** hides CRUD behind simple mutations
5. **Upload Module** hides Blob complexity behind presigned URL pattern

**Testing Strategy:**
- Convex functions: Use `convex-test` for unit tests (DESIGN.md lines 1572-1806)
- UI components: Visual testing during development
- E2E flows: Manual testing of critical paths before launch
- Privacy: Dedicated security audit before production

**Simplicity Checkpoints:**
- If adding Manager/Helper/Util classes → reconsider abstraction
- If mutation needs 3+ database queries → might need rethinking
- If component has 5+ props → too shallow, needs deeper interface
- If tests need heavy mocking → too coupled, refactor

**Performance Targets:**
- Page load (LCP): < 1 second
- Query response: < 100ms
- Mutation response: < 200ms
- Search API: < 1 second
- File upload: < 3 seconds for 5MB

---

**Ready to implement. Ship beautiful code. 🚀**
