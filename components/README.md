# Components

This directory contains all React components for bibliomnomnom, organized by domain.

## Directory Structure

```
components/
├── ui/                 # shadcn/ui primitives (generated)
├── book/               # Book-related components
├── notes/              # Note/quote/reflection components
├── navigation/         # Navigation and layout
└── shared/             # Shared utilities (error, loading, empty states)
```

## Component Guidelines

### 1. Use shadcn/ui Primitives

All custom components should build on shadcn/ui primitives:

```typescript
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";

export function AddBookModal() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>Add Book</DialogHeader>
        <Button>Save</Button>
      </DialogContent>
    </Dialog>
  );
}
```

**Why**: Consistent styling, accessibility baked in, Radix UI primitives.

### 2. Use Convex Hooks for Data

Components should use Convex hooks, not direct API calls:

```typescript
import { useAuthedQuery, useMutation } from "@/lib/hooks/useAuthedQuery";
import { api } from "@/convex/_generated/api";

export function BookGrid() {
  // Query automatically subscribes to real-time updates
  const books = useAuthedQuery(api.books.list, {});

  // Mutation for writes
  const deleteBook = useMutation(api.books.remove);

  if (books === undefined) return <div>Loading...</div>;
  if (books === null) return <div>Please sign in</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {books.map((book) => (
        <BookCard key={book._id} book={book} onDelete={deleteBook} />
      ))}
    </div>
  );
}
```

**Why**: Real-time reactivity, automatic re-fetching, type safety.

### 3. Optimistic Updates for Better UX

Use Convex optimistic updates for instant feedback:

```typescript
export function ToggleFavorite({ bookId, isFavorite }) {
  const toggleFavorite = useMutation(api.books.toggleFavorite);

  return (
    <button
      onClick={() => {
        // UI updates instantly, mutation runs in background
        toggleFavorite({ id: bookId });
      }}
    >
      {isFavorite ? "★" : "☆"}
    </button>
  );
}
```

**Why**: No loading spinner, feels instant, automatically rolls back on error.

### 4. Error Boundaries for Graceful Failures

Wrap sections that might fail:

```typescript
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

export function BookDetail() {
  return (
    <ErrorBoundary fallback={<ErrorState />}>
      <CoverImage />
      <BookMetadata />
      <NoteList />
    </ErrorBoundary>
  );
}
```

**Why**: Prevents entire page from crashing if one section fails.

### 5. Loading and Empty States

Always handle loading and empty cases:

```typescript
export function BookList() {
  const books = useAuthedQuery(api.books.list, {});

  // Loading state
  if (books === undefined) {
    return <LoadingSkeleton count={6} />;
  }

  // Auth error
  if (books === null) {
    return <ErrorState message="Please sign in to view your library" />;
  }

  // Empty state
  if (books.length === 0) {
    return <EmptyState message="No books yet. Click 'Add Book' to get started!" />;
  }

  // Success state
  return books.map((book) => <BookCard key={book._id} book={book} />);
}
```

**Why**: Clear feedback, no blank screens, better UX.

## Component Patterns

### Pattern 1: Presentational Components

Pure components that receive props:

```typescript
interface BookCardProps {
  book: Doc<"books">;
  onDelete: (id: Id<"books">) => void;
}

export function BookCard({ book, onDelete }: BookCardProps) {
  return (
    <div className="border rounded p-4">
      <h3>{book.title}</h3>
      <p>{book.author}</p>
      <Button onClick={() => onDelete(book._id)} variant="destructive">
        Delete
      </Button>
    </div>
  );
}
```

**When to use**: Leaf components, reusable UI elements.

### Pattern 2: Container Components

Components that fetch data and manage state:

```typescript
export function BookGrid() {
  const books = useAuthedQuery(api.books.list, {});
  const [filter, setFilter] = useState<string | null>(null);

  const filteredBooks = books?.filter((book) =>
    filter ? book.status === filter : true
  );

  return (
    <div>
      <FilterBar value={filter} onChange={setFilter} />
      <div className="grid grid-cols-3 gap-4">
        {filteredBooks?.map((book) => <BookCard key={book._id} book={book} />)}
      </div>
    </div>
  );
}
```

**When to use**: Page-level components, data orchestration.

### Pattern 3: Modal Components

Dialogs for create/edit actions:

```typescript
export function AddBookModal({ open, onOpenChange }) {
  const createBook = useMutation(api.books.create);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

  const handleSubmit = async () => {
    await createBook({ title, author, status: "want-to-read" });
    onOpenChange(false); // Close modal
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Book</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" />
          <Button onClick={handleSubmit}>Add Book</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**When to use**: Create/edit/delete operations, confirmations.

## Styling Conventions

### 1. Use Tailwind Utility Classes

```typescript
<div className="flex items-center gap-4 p-6 border-b">
  <h1 className="text-2xl font-serif text-ink">Library</h1>
  <Button variant="outline" size="sm">Add Book</Button>
</div>
```

### 2. Use Design Tokens

Reference tokens from `lib/design/tokens.generated.ts`:

```typescript
import { tokens } from "@/lib/design/tokens.generated";

<div style={{ color: tokens.color.ink, fontFamily: tokens.font.family.serif }}>
  Warm, sepia aesthetic
</div>
```

**Better**: Use Tailwind's theme:

```typescript
<div className="text-ink font-serif">Warm, sepia aesthetic</div>
```

### 3. Semantic Class Names

Use `cn()` utility for conditional classes:

```typescript
import { cn } from "@/lib/utils";

<button
  className={cn(
    "px-4 py-2 rounded",
    isActive && "bg-leather text-paper",
    isDisabled && "opacity-50 cursor-not-allowed"
  )}
>
  Button
</button>
```

## Component Organization

### Small Components (<100 lines)

Keep in single file:

```
components/book/BookCard.tsx
```

### Large Components (>100 lines)

Extract sub-components:

```
components/book/
├── BookDetail.tsx         # Main component
├── BookMetadata.tsx       # Metadata section
├── CoverUpload.tsx        # Cover upload section
└── index.ts               # Barrel export
```

**Current concern**: `BookDetail.tsx` is 521 lines (needs refactoring per ARCHITECTURE.md).

## Testing Components

### Current: Manual Testing

Test components via Storybook (configured but no stories yet) or browser.

### Future: Automated Tests

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { BookCard } from "./BookCard";

test("renders book title and author", () => {
  const book = {
    _id: "123",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    status: "read",
  };

  render(<BookCard book={book} onDelete={() => {}} />);

  expect(screen.getByText("The Hobbit")).toBeInTheDocument();
  expect(screen.getByText("J.R.R. Tolkien")).toBeInTheDocument();
});

test("calls onDelete when delete button clicked", async () => {
  const onDelete = vi.fn();
  const book = { _id: "123", title: "Test", author: "Author", status: "read" };

  render(<BookCard book={book} onDelete={onDelete} />);

  const deleteButton = screen.getByRole("button", { name: /delete/i });
  deleteButton.click();

  await waitFor(() => expect(onDelete).toHaveBeenCalledWith("123"));
});
```

See [BACKLOG.md](../BACKLOG.md) for component testing roadmap.

## Common Issues

### Component not re-rendering after mutation

**Cause**: Not using Convex hooks or mutation not updating database.
**Fix**: Use `useAuthedQuery` for reads (auto-subscribes to changes).

### "Cannot read property 'title' of undefined"

**Cause**: Data still loading (query returns `undefined` during fetch).
**Fix**: Add loading state check before accessing data.

### Styles not applying

**Cause**: Tailwind class name not recognized or CSS not rebuilt.
**Fix**: Restart `pnpm dev` to rebuild Tailwind.

### Type errors on Convex data

**Cause**: Generated types out of sync with schema.
**Fix**: Run `pnpm convex:push` to regenerate types.

## Best Practices

### ✅ DO:

- Use `useAuthedQuery` for Convex data (auto-subscribes)
- Handle loading, empty, and error states
- Use shadcn/ui primitives for consistency
- Extract large components into smaller sub-components
- Use Tailwind utility classes for styling
- Add `key` prop to mapped elements

### ❌ DON'T:

- Fetch data with `useEffect` + `fetch` (use Convex hooks)
- Mutate props (components should be pure)
- Store server state in `useState` (use Convex reactivity)
- Import from `@/convex/*` (use `@/convex/_generated/api` only)
- Hardcode colors/fonts (use Tailwind theme tokens)

## Related Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Component layer in system architecture
- [DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md) - Design tokens and styling guide
- [shadcn/ui docs](https://ui.shadcn.com) - Component library documentation
- [Convex React docs](https://docs.convex.dev/client/react) - Convex hooks reference
