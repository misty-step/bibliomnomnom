import { describe, expect, it } from "vitest";

import { inferGenericCsv } from "../../lib/import/client/csvInfer";

describe("inferGenericCsv", () => {
  it("parses common aliases and normalizes fields", () => {
    const csv = [
      "Book Title,Writer,ISBN13,Pages,Year,Audiobook,Favorite,Status,Cover",
      "  The Overstory  , Richard Powers ,978-0393356687,512,2018,yes,1,currently-reading,https://img.example/over.jpg",
    ].join("\n");

    const result = inferGenericCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.title).toBe("The Overstory");
    expect(row.author).toBe("Richard Powers");
    expect(row.isbn).toBe("9780393356687");
    expect(row.pageCount).toBe(512);
    expect(row.publishedYear).toBe(2018);
    expect(row.isAudiobook).toBe(true);
    expect(row.isFavorite).toBe(true);
    expect(row.status).toBe("currently-reading");
    expect(row.coverUrl).toBe("https://img.example/over.jpg");
  });

  it("fails fast when required columns are missing", () => {
    const csv = "Writer,ISBN\nFrank Herbert,9780441013593\n";

    const result = inferGenericCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Missing required columns");
  });

  it("flags rows missing required fields as errors", () => {
    const csv = "Title,Author\n,No Author\nDune,\n";

    const result = inferGenericCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });

  it("handles large row counts without crashing", () => {
    const header = "Title,Author,Pages";
    const rows = Array.from({ length: 1000 }, (_, i) => `Book ${i},Author ${i},${i}`);
    const csv = [header, ...rows].join("\n");

    const result = inferGenericCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1000);
  });
});
