# Photo Quote Capture State Machine

The PhotoQuoteCapture component (`components/notes/PhotoQuoteCapture.tsx`) handles camera-based OCR for extracting quotes from book pages.

## State Machine

```mermaid
stateDiagram-v2
    [*] --> idle

    idle --> preview: File selected

    preview --> processing: Use Photo clicked
    preview --> idle: Retake (opens file picker)
    preview --> idle: Cancel

    processing --> success: OCR returns text
    processing --> error: OCR fails / timeout

    success --> idle: Save quote
    success --> idle: Cancel
    success --> preview: Retake (with new file)

    error --> preview: Try Again
    error --> idle: Retake (opens file picker)
    error --> idle: Cancel

    note right of processing
        35s timeout
        Shows staged loading messages:
        - "Preparing photo..."
        - "Reading text..."
        - "Almost done..."
    end note

    note right of success
        Text is editable before save.
        isSaving flag prevents dialog close.
    end note
```

## State Definition

```typescript
type CaptureState =
  | { step: "idle" }
  | { step: "preview"; previewUrl: string }
  | { step: "processing"; previewUrl: string }
  | { step: "success"; text: string; previewUrl: string }
  | { step: "error"; message: string; previewUrl?: string };
```

## Non-Linear Transitions

1. **Retake from any state**: User can always choose to take a new photo
2. **Try Again from error**: Returns to preview to retry OCR without new photo
3. **Edit in success**: Text is mutable before final save

## Error Handling

| Error Type    | Message                                 | Recovery                  |
| ------------- | --------------------------------------- | ------------------------- |
| Timeout (35s) | "Taking too long. Please try again."    | Try Again or Retake       |
| OCR failure   | Server error message                    | Try Again or Retake       |
| No text found | "No text found in image."               | Retake with clearer photo |
| Network error | "Network error. Check your connection." | Try Again                 |

## Image Processing Pipeline

```mermaid
flowchart LR
    A[File Selected] --> B{Size/Type OK?}
    B -->|No| C[Show Toast Error]
    B -->|Yes| D[Create Preview URL]
    D --> E[Show Preview]
    E --> F{Use Photo?}
    F -->|Yes| G{Under 2MB JPEG?}
    G -->|Yes| H[Use as-is]
    G -->|No| I[Transcode to JPEG]
    I --> J{Under limit?}
    J -->|No| K[Error: Too Large]
    J -->|Yes| H
    H --> L[POST /api/ocr]
```

## Side Effect Management

- `selectedFileRef`: Preserves File object across renders
- `previewUrlRef`: Manages object URL lifecycle (revoke on cleanup)
- `isSaving`: Prevents dialog close during mutation
- Loading messages: Timer-based progression during processing
