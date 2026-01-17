# Book Cover Manager Flow

The BookCoverManager component (`components/book/BookCoverManager.tsx`) handles multiple cover source types with upload, search, auto-fetch, and removal operations.

## Cover Source State

```mermaid
stateDiagram-v2
    [*] --> no_cover: Book created without cover

    no_cover --> uploading: User selects file
    no_cover --> auto_fetching: "Auto-Fetch" clicked
    no_cover --> picker_open: "Search Web" clicked

    uploading --> has_user_cover: Upload succeeds
    uploading --> no_cover: Upload fails

    auto_fetching --> has_api_cover: Cover found
    auto_fetching --> no_cover: No cover found

    picker_open --> downloading: User selects cover
    picker_open --> no_cover: Dialog closed

    downloading --> has_api_cover: Download + upload succeeds
    downloading --> no_cover: Download fails

    has_user_cover --> no_cover: Remove clicked
    has_user_cover --> uploading: Replace via upload
    has_user_cover --> picker_open: Replace via search

    has_api_cover --> no_cover: Remove clicked
    has_api_cover --> uploading: Replace via upload
    has_api_cover --> picker_open: Replace via search

    note right of has_user_cover
        coverUrl set (Vercel Blob)
        apiCoverUrl null
    end note

    note right of has_api_cover
        coverUrl set (Vercel Blob)
        apiCoverUrl set (original source)
        apiSource: "open-library" | "google-books"
    end note
```

## Operation Flows

### Manual Upload

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant Blob as Vercel Blob
    participant Convex

    User->>Component: Select file
    Component->>Component: Validate type (JPEG/PNG/WebP)
    Component->>Component: Validate size (< 5MB)

    alt Invalid file
        Component-->>User: Toast error
    else Valid file
        Component->>Component: isUploading = true
        Component->>Blob: upload() with presigned URL
        Blob-->>Component: blob.url
        Component->>Convex: updateBook({ coverUrl })
        Component-->>User: Toast "Cover updated"
        Component->>Component: isUploading = false
    end
```

### Auto-Fetch ("I'm Feeling Lucky")

```mermaid
sequenceDiagram
    participant User
    participant Component
    participant Action as fetchCover action
    participant APIs as Open Library / Google Books
    participant Blob as Vercel Blob
    participant Convex

    User->>Component: Click "Auto-Fetch"
    Component->>Component: isUploading = true
    Component->>Action: fetchBestCover({ bookId })
    Action->>Convex: Get book (title, author, isbn)
    Action->>APIs: Search by ISBN, then title/author

    alt No cover found
        Action-->>Component: { success: false }
        Component-->>User: Toast "No cover found"
    else Cover found
        Action->>APIs: Fetch image bytes
        Action-->>Component: { coverDataUrl, apiSource, apiCoverUrl }
        Component->>Component: Convert base64 to Blob
        Component->>Blob: upload()
        Blob-->>Component: blobUrl
        Component->>Convex: updateCoverFromBlob({ blobUrl, apiSource, apiCoverUrl })
        Component-->>User: Toast "Cover found and saved"
    end

    Component->>Component: isUploading = false
```

### Web Search + Select

```mermaid
sequenceDiagram
    participant User
    participant Picker as CoverPicker
    participant Action as searchCovers
    participant APIs as Open Library / Google Books

    User->>Picker: Dialog opens
    Picker->>Action: searchCovers({ title, author, isbn })
    Action->>APIs: Parallel search

    APIs-->>Action: Results array
    Action-->>Picker: candidates[]

    Picker->>User: Display grid

    User->>Picker: Select cover
    Picker->>Component: onSelect(url, source, apiId)
    Component->>Component: isUploading = true

    Component->>Action: downloadImage({ url })
    Note over Action: Server-side fetch bypasses CORS
    Action-->>Component: { dataUrl }

    Component->>Blob: upload()
    Blob-->>Component: blobUrl
    Component->>Convex: updateCoverFromBlob()
    Component-->>User: Toast "Cover updated"
```

## Cover Storage Model

The book record stores both user uploads and API covers:

```typescript
type Book = {
  coverUrl?: string; // User uploaded (Vercel Blob URL)
  apiCoverUrl?: string; // Original API URL (for attribution)
  apiSource?: "open-library" | "google-books" | "manual";
  apiId?: string; // Source-specific ID
};
```

Display priority: `coverUrl ?? apiCoverUrl`

## Error Handling

| Error             | User Feedback                           | Recovery                      |
| ----------------- | --------------------------------------- | ----------------------------- |
| Invalid file type | Toast: "Please upload JPG/PNG/WebP"     | Select different file         |
| File too large    | Toast: "Images must be < 5MB"           | Compress and retry            |
| Upload failed     | Toast: "Upload failed. Try again."      | Retry                         |
| No cover found    | Toast: "No cover found"                 | Try manual search             |
| Auto-fetch failed | Toast: "Try searching manually"         | Use CoverPicker               |
| Download failed   | Toast: "Could not download from source" | Try different cover or upload |

## UI States

```mermaid
flowchart TD
    A{activeCover exists?}
    A -->|Yes| B[Show cover image]
    A -->|No| C[Show placeholder with title/author]

    B --> D{isHovered or isUploading?}
    D -->|Yes| E[Show overlay]
    E --> F{isUploading?}
    F -->|Yes| G[Show spinner + "Updating..."]
    F -->|No| H[Show action buttons]
    H --> I[Search Web]
    H --> J[Upload File]
    H --> K[Remove]

    C --> L{isUploading?}
    L -->|Yes| M[Show spinner in dashed box]
    L -->|No| N[Show action buttons]
    N --> O[Auto-Fetch]
    N --> P[Search Web]
    N --> Q[Upload File]
```

## Local State

```typescript
const [isHovered, setIsHovered] = useState(false); // Overlay visibility
const [isUploading, setIsUploading] = useState(false); // Loading state for all operations
const [showPicker, setShowPicker] = useState(false); // CoverPicker dialog
const fileInputRef = useRef<HTMLInputElement>(null); // Hidden file input
```

Only one piece of async state (`isUploading`) guards all operations, preventing race conditions from concurrent uploads/fetches.
