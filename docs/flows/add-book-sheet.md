# Add Book Sheet Flow

The AddBookSheet component (`components/book/AddBookSheet.tsx`) manages a multi-step book creation form with search integration.

## State Overview

While not a formal state machine, this component has significant state complexity:

```mermaid
flowchart TD
    subgraph "Form State"
        title[title]
        author[author]
        status[status]
        coverFile[coverFile]
        coverPreview[coverPreview]
        isFavorite[isFavorite]
        isAudiobook[isAudiobook]
        dateFinished[dateFinished]
    end

    subgraph "API Search State"
        apiId[apiId]
        apiSource[apiSource: manual | open-library | google-books]
        isbn[isbn]
        publishedYear[publishedYear]
        pageCount[pageCount]
        apiCoverUrl[apiCoverUrl]
    end

    subgraph "UI State"
        isOpen[isOpen]
        isSubmitting[isSubmitting]
        error[error]
        showCoverPicker[showCoverPicker]
    end
```

## Cover Selection Flow

```mermaid
stateDiagram-v2
    [*] --> no_cover

    no_cover --> uploading: File input change
    no_cover --> picker_open: "Search Web" clicked

    uploading --> has_cover: File validated
    uploading --> no_cover: Validation failed

    picker_open --> has_cover: Cover selected
    picker_open --> no_cover: Dialog closed

    has_cover --> no_cover: Remove clicked
    has_cover --> picker_open: "Web Search" overlay clicked
    has_cover --> uploading: "Upload File" overlay clicked

    note right of has_cover
        coverPreview set to:
        - Data URL (file upload)
        - API URL (search result)

        Source tracked in apiSource
    end note
```

## Form Submission Flow

```mermaid
sequenceDiagram
    participant User
    participant Form
    participant Blob as Vercel Blob
    participant Convex
    participant Backfill

    User->>Form: Submit
    Form->>Form: Validate title/author

    alt Has cover file
        Form->>Blob: Upload to presigned URL
        Blob-->>Form: blob.url
    end

    Form->>Convex: createBook mutation
    Convex-->>Form: bookId

    alt No cover & backfill enabled
        Form->>Backfill: fetchMissingCovers([bookId])
        Note over Backfill: Fire and forget
    end

    Form->>Form: handleClose() resets state
    Form->>User: Toast "Book added"
```

## Controlled vs Uncontrolled Mode

The component supports both modes:

```typescript
// Uncontrolled (manages own state)
<AddBookSheet triggerLabel="Add Book" />

// Controlled (parent manages open state)
<AddBookSheet
  isOpen={isModalOpen}
  onOpenChange={setIsModalOpen}
/>
```

## State Reset on Close

`handleClose()` resets all 15+ state variables:

- Form fields (title, author, status, dates, flags)
- Cover state (file, preview, API cover)
- Search result fields (apiId, apiSource, isbn, etc.)
- UI state (error, cover picker)

## Race Condition Prevention

- `isSubmitting` disables all inputs during submission
- Blob upload completes before mutation call
- Cover backfill is fire-and-forget (doesn't block close)
