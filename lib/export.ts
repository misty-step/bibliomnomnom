import type { Doc } from "@/convex/_generated/dataModel";

export type ExportData = {
  version: string;
  exportedAt: number;
  books: Doc<"books">[];
  notes: Doc<"notes">[];
};

const CSV_HEADERS = [
  "Title",
  "Author",
  "ISBN",
  "My Rating",
  "Date Read",
  "Date Added",
  "Bookshelves",
  "My Review",
];

function formatDateYmd(timestamp: number): string {
  const [formatted] = new Date(timestamp).toISOString().split("T");
  return formatted ?? "";
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function toJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function toCSV(data: ExportData): string {
  const rows = data.books.map((book) => {
    const shelf =
      book.status === "read"
        ? "read"
        : book.status === "currently-reading"
          ? "currently-reading"
          : "to-read";
    const dateRead = book.dateFinished ? formatDateYmd(book.dateFinished) : "";
    const dateAdded = formatDateYmd(book.createdAt);

    return [
      escapeCsv(book.title ?? ""),
      escapeCsv(book.author ?? ""),
      book.isbn ?? "",
      book.isFavorite ? "5" : "",
      dateRead,
      dateAdded,
      shelf,
      "",
    ].join(",");
  });

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function toMarkdown(data: ExportData): string {
  const formattedDate = new Date(data.exportedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = ["# My Library", "", `*Exported ${formattedDate}*`, ""];
  const currentlyReading = data.books.filter((book) => book.status === "currently-reading");
  const read = data.books.filter((book) => book.status === "read");
  const wantToRead = data.books.filter((book) => book.status === "want-to-read");

  const notesMap = new Map<Doc<"books">["_id"], Doc<"notes">[]>();
  for (const note of data.notes) {
    const existing = notesMap.get(note.bookId) ?? [];
    existing.push(note);
    notesMap.set(note.bookId, existing);
  }

  const renderBookSection = (title: string, books: Doc<"books">[]) => {
    if (books.length === 0) {
      return;
    }

    lines.push(`## ${title}`, "");

    for (const book of books) {
      lines.push(`### ${book.title}`);
      lines.push(`**Author:** ${book.author ?? "Unknown"}`);

      if (book.publishedYear) {
        lines.push(`**Year:** ${book.publishedYear}`);
      }

      if (book.pageCount) {
        lines.push(`**Pages:** ${book.pageCount}`);
      }

      if (book.isFavorite) {
        lines.push("**⭐ Favorite**");
      }

      if (book.dateFinished) {
        lines.push(`**Finished:** ${new Date(book.dateFinished).toLocaleDateString()}`);
      }

      const bookNotes = notesMap.get(book._id) ?? [];
      if (bookNotes.length > 0) {
        lines.push("", "**Notes:**");
        for (const note of bookNotes) {
          const noteText = note.type === "quote" ? `> ${note.content}` : note.content;
          lines.push(`- ${noteText}`);
        }
      }

      lines.push("");
    }
  };

  renderBookSection("Currently Reading", currentlyReading);
  renderBookSection("Read", read);
  renderBookSection("Want to Read", wantToRead);

  return lines.join("\n");
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
