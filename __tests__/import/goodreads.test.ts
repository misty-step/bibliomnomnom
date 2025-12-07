import { describe, expect, it } from "vitest";

import { parseGoodreadsCsv } from "../../lib/import/client/goodreads";

const CSV_HEADER =
  "Title,Author,ISBN,ISBN13,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Exclusive Shelf\n";

describe("parseGoodreadsCsv", () => {
  it("parses happy path rows with status mapping", () => {
    const csv =
      CSV_HEADER +
      "The Hobbit,J. R. R. Tolkien,1234567890,978-1234567897,310,1937,1937,2023-01-01,2022-12-01,read,read\n" +
      "Dune,Frank Herbert,,9780441013593,412,1965,1965,,2023-02-01,to-read,to-read\n";

    const result = parseGoodreadsCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);

    const hobbit = result.rows[0]!;
    expect(hobbit.title).toBe("The Hobbit");
    expect(hobbit.author).toBe("J. R. R. Tolkien");
    expect(hobbit.status).toBe("read");
    expect(hobbit.isbn).toBe("1234567890");
    expect(hobbit.pageCount).toBe(310);
    expect(hobbit.publishedYear).toBe(1937);
    expect(hobbit.dateFinished).toBeDefined();

    const dune = result.rows[1]!;
    expect(dune.status).toBe("want-to-read"); // to-read maps to want-to-read
    expect(dune.isbn).toBe("9780441013593");
  });

  it("emits warning and defaults status for unknown shelf", () => {
    const csv = CSV_HEADER + "Book,Author,,,,,,,someday-maybe,someday-maybe\n";

    const result = parseGoodreadsCsv(csv);

    expect(result.rows[0]!.status).toBe("want-to-read");
    expect(result.warnings[0]).toContain("Unrecognized shelf");
  });

  it("reports missing required fields as errors and skips row", () => {
    const csv = CSV_HEADER + ",Author Only,,,,,,,,read,read\n";

    const result = parseGoodreadsCsv(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.line).toBe(2);
  });

  it("strips BOM and trims whitespace", () => {
    const csv = `\uFEFF${CSV_HEADER}"  Title With Spaces  ","  Author  ",,,,,,,,read,read\n`;

    const result = parseGoodreadsCsv(csv);

    expect(result.rows[0]!.title).toBe("Title With Spaces");
    expect(result.rows[0]!.author).toBe("Author");
  });

  it("treats empty ISBN cells as undefined", () => {
    const csv = CSV_HEADER + "Book,Author,, ,,,,,,,read,read\n";

    const result = parseGoodreadsCsv(csv);

    expect(result.rows[0]!.isbn).toBeUndefined();
  });

  it("normalizes valid ISBN with spaces and dashes", () => {
    const csv = CSV_HEADER + "Book,Author, ,978-0-441-01359-3 ,,,,,,,read,read\n";

    const result = parseGoodreadsCsv(csv);

    expect(result.rows[0]!.isbn).toBe("9780441013593");
  });
});
