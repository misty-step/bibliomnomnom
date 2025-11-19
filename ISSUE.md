tried adding a book. failed:
```
## Error Type
Console Error

## Error Message
[CONVEX M(books:create)] [Request ID: cc3d7fb9f03a4a52] Server Error
ArgumentValidationError: Object contains extra field `isFavorite` that is not in the validator.

Object: {apiSource: "manual", author: "Various Authors", coverUrl: "https://k2oi8tvopbf3nxxk.public.blob.vercel-storage.com/the-bible-the-old-testament-02.png", isAudiobook: false, isFavorite: false, status: "currently-reading", title: "The Old Testament"}
Validator: v.object({apiCoverUrl: v.optional(v.string()), apiId: v.optional(v.string()), apiSource: v.optional(v.union(v.literal("google-books"), v.literal("open-library"), v.literal("manual"))), author: v.string(), coverUrl: v.optional(v.string()), description: v.optional(v.string()), edition: v.optional(v.string()), isAudiobook: v.optional(v.boolean()), isbn: v.optional(v.string()), pageCount: v.optional(v.float64()), publishedYear: v.optional(v.float64()), status: v.union(v.literal("want-to-read"), v.literal("currently-reading"), v.literal("read")), title: v.string()})



Next.js version: 15.5.6 (Turbopack)
```

and:
```
## Error Type
Console Error

## Error Message
[CONVEX M(books:create)] [Request ID: cc3d7fb9f03a4a52] Server Error
ArgumentValidationError: Object contains extra field `isFavorite` that is not in the validator.

Object: {apiSource: "manual", author: "Various Authors", coverUrl: "https://k2oi8tvopbf3nxxk.public.blob.vercel-storage.com/the-bible-the-old-testament-02.png", isAudiobook: false, isFavorite: false, status: "currently-reading", title: "The Old Testament"}
Validator: v.object({apiCoverUrl: v.optional(v.string()), apiId: v.optional(v.string()), apiSource: v.optional(v.union(v.literal("google-books"), v.literal("open-library"), v.literal("manual"))), author: v.string(), coverUrl: v.optional(v.string()), description: v.optional(v.string()), edition: v.optional(v.string()), isAudiobook: v.optional(v.boolean()), isbn: v.optional(v.string()), pageCount: v.optional(v.float64()), publishedYear: v.optional(v.float64()), status: v.union(v.literal("want-to-read"), v.literal("currently-reading"), v.literal("read")), title: v.string()})


  Called by client


    at async handleSubmit (components/book/AddBookSheet.tsx:112:7)

## Code Frame
  110 |
  111 |       // Create book
> 112 |       await createBook({
      |       ^
  113 |         title: trimmedTitle,
  114 |         author: trimmedAuthor,
  115 |         status,

Next.js version: 15.5.6 (Turbopack)

```
