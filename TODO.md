- [x] Add delete book functionality
  ```
  Files:
  - components/book/BookDetail.tsx:28-35 (add delete mutation + state)
  - components/book/BookDetail.tsx:289-379 (add delete button in action row)
  - components/ui/alert-dialog.tsx (NEW FILE - install shadcn component)

  Pattern: Follow NoteCard.tsx:67-76 delete implementation, but replace native confirm()
  with custom AlertDialog (per BACKLOG.md:1010 UX requirement)

  Approach:
  1. Install shadcn AlertDialog component
     npx shadcn@latest add alert-dialog

  2. Import dependencies in BookDetail.tsx
     - useRouter from next/navigation (for redirect after delete)
     - Trash2 from lucide-react (delete icon)
     - AlertDialog components from @/components/ui/alert-dialog

  3. Add delete mutation and state (after line 34)
     const removeBook = useMutation(api.books.remove);
     const router = useRouter();
     const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  4. Query note count for confirmation message
     const notes = useAuthedQuery(api.notes.list, { bookId: book._id });
     const noteCount = notes?.length ?? 0;

  5. Implement delete handler
     - Call removeBook({ id: book._id })
     - Show success toast
     - router.push("/library") to redirect
     - Error handling with destructive toast

  6. Add delete button in action row (after privacy toggle, line ~340)
     - AlertDialog trigger with Trash2 icon
     - Show book title and note count in confirmation
     - "Delete Forever" destructive action button
     - Cancel button to close without deleting

  Success Criteria:
  - [ ] Delete button appears in BookDetail action row
  - [ ] Clicking delete shows AlertDialog with book title and note count
  - [ ] Confirming delete removes book and redirects to /library
  - [ ] Toast notification confirms deletion
  - [ ] Canceling closes dialog without deleting
  - [ ] Error handling shows toast on failure

  Edge Cases:
  - Book with 0 notes → "permanently delete this book"
  - Book with 1 note → "1 note" (singular)
  - Book with multiple notes → "N notes" (plural)
  - Network failure → toast error, book not deleted

  Dependencies:
  - Convex api.books.remove mutation exists ✅ (convex/books.ts:207)
  - shadcn AlertDialog component (must install first)

  NOT in Scope:
  - Soft delete / trash functionality
  - Batch delete multiple books
  - Cascade delete notes (backend handles automatically)
  - Undo delete

  Estimate: 45m
  ```

- [ ] Show title + author for books without covers
  ```
  Files:
  - components/book/BookTile.tsx:67-71 (replace single letter with title/author)
  - components/book/BookDetail.tsx:225-228 (same pattern for detail page)

  Pattern: Reuse existing hover state layout (BookTile.tsx:75-98) but make it
  the default when no cover exists

  Context: With 400 books uploaded and no covers, single-letter fallback creates
  wall of indistinguishable "D D D T T M M" blocks. Title + author makes books
  scannable and identifiable.

  Approach:
  1. BookTile.tsx - Replace single letter fallback (lines 67-71)
     - Show title (font-display, text-lg, line-clamp-5)
     - Show author (font-mono, text-xs uppercase, line-clamp-2)
     - Show year at bottom if available (font-mono, text-xs)
     - Background: bg-canvas-bone with border-line-ghost/50
     - Spacing: p-5, justify-between flex layout

  2. BookDetail.tsx - Same pattern for detail cover (lines 225-228)
     - Larger text sizes (text-2xl for title, text-sm for author)
     - More padding (p-8 instead of p-5)
     - Same structure: title > author > year (optional)

  Success Criteria:
  - [ ] Books without covers show title + author instead of single letter
  - [ ] Text is readable and properly sized (lg for tiles, 2xl for detail)
  - [ ] Layout matches bibliophile aesthetic (serif title, mono author)
  - [ ] Published year shows at bottom if available
  - [ ] Hover state still works on tiles (index card overlay)
  - [ ] Visual hierarchy clear: title > author > year

  Edge Cases:
  - Very long titles (100+ chars) → line-clamp-5 truncation
  - Missing author → show title only
  - Missing year → hide bottom section
  - Title + author both long → flex layout handles proportional spacing

  Design Tokens:
  - Background: bg-canvas-bone
  - Border: border-line-ghost/50
  - Title: font-display text-text-ink (Crimson Text serif)
  - Author: font-mono text-text-inkMuted (JetBrains Mono uppercase)
  - Year: font-mono text-text-inkSubtle

  NOT in Scope:
  - AI-generated covers (future feature)
  - Fetching covers from external API (future feature)
  - Gradient/color variations per book

  Estimate: 30m
  ```
