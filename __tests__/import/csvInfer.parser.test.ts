import { describe, expect, it } from "vitest";
import { inferGenericCsv } from "../../lib/import/client/csvInfer";

describe("inferGenericCsv parser internals", () => {
  it("handles quoted fields with commas", () => {
    const csv = 'Title,Author\n"Dune, Messiah",Frank Herbert';
    const result = inferGenericCsv(csv);
    expect(result.rows[0].title).toBe("Dune, Messiah");
    expect(result.rows[0].author).toBe("Frank Herbert");
  });

  it("handles quoted fields with newlines", () => {
    const csv = 'Title,Author\n"Dune\nMessiah",Frank Herbert';
    const result = inferGenericCsv(csv);
    expect(result.rows[0].title).toBe("Dune Messiah");
  });

  it("handles escaped quotes", () => {
    const csv = 'Title,Author\n"Dune ""Messiah""",Frank Herbert';
    const result = inferGenericCsv(csv);
    expect(result.rows[0].title).toBe('Dune "Messiah"');
  });

  it("handles CRLF line endings", () => {
    const csv = "Title,Author\r\nDune,Frank Herbert\r\nMessiah,Frank Herbert";
    const result = inferGenericCsv(csv);
    expect(result.rows).toHaveLength(2);
  });

  it("handles BOM", () => {
    const csv = "\uFEFFTitle,Author\nDune,Frank Herbert";
    const result = inferGenericCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe("Dune");
  });

  it("handles empty file", () => {
    const result = inferGenericCsv("");
    expect(result.warnings).toContain("Empty CSV file");
  });
});

describe("inferGenericCsv value mapping", () => {
  it("handles boolean variations", () => {
    const csv = `Title,Author,Audiobook
      B1,A1,yes
      B2,A2,y
      B3,A3,1
      B4,A4,true
      B5,A5,no
      B6,A6,n
      B7,A7,0
      B8,A8,false
      B9,A9,other
    `;
    const result = inferGenericCsv(csv);
    expect(result.rows[0].isAudiobook).toBe(true);
    expect(result.rows[1].isAudiobook).toBe(true);
    expect(result.rows[2].isAudiobook).toBe(true);
    expect(result.rows[3].isAudiobook).toBe(true);
    expect(result.rows[4].isAudiobook).toBe(false);
    expect(result.rows[5].isAudiobook).toBe(false);
    expect(result.rows[6].isAudiobook).toBe(false);
    expect(result.rows[7].isAudiobook).toBe(false);
    expect(result.rows[8].isAudiobook).toBeUndefined();
  });

  it("handles number parsing", () => {
    const csv = `Title,Author,Pages
      B1,A1,100
      B2,A2,nan
      B3,A3,
    `;
    const result = inferGenericCsv(csv);
    expect(result.rows[0].pageCount).toBe(100);
    expect(result.rows[1].pageCount).toBeUndefined();
    expect(result.rows[2].pageCount).toBeUndefined();
  });

  it("handles privacy", () => {
    const csv = `Title,Author,Privacy
        B1,A1,public
        B2,A2,private
        B3,A3,unknown
      `;
    const result = inferGenericCsv(csv);
    expect(result.rows[0].privacy).toBe("public");
    expect(result.rows[1].privacy).toBe("private");
    expect(result.rows[2].privacy).toBe("private");
  });

  it("warns on unused columns", () => {
    const csv = "Title,Author,Extra";
    const result = inferGenericCsv(csv);
    expect(result.warnings[0]).toContain("Ignored columns: Extra");
  });
});
