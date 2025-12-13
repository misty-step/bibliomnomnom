const DASH_LIKE = new Set(["-", "—", "–"]);

function isLetter(char: string): boolean {
  // ASCII letters cover most OCR output; avoids pulling in heavy Unicode regex support.
  return /[A-Za-z]/.test(char);
}

function cleanLine(line: string): string {
  return line.replace(/\u00ad/g, "").trim();
}

function joinWrappedLines(lines: string[]): string {
  let out = "";

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    if (!out) {
      out = line;
      continue;
    }

    const lastChar = out[out.length - 1] ?? "";
    const nextChar = line[0] ?? "";

    // De-hyphenate common line-wrap hyphenation: "wrap-\nped" -> "wrapped"
    if (lastChar === "-" && isLetter(nextChar)) {
      out = out.slice(0, -1) + line;
      continue;
    }

    // Avoid injecting spaces after dash-like characters (em-dash at line end).
    if (DASH_LIKE.has(lastChar)) {
      out = out + line;
      continue;
    }

    out = out + " " + line;
  }

  // Normalize whitespace + common OCR spacing artifacts.
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Formats OCR text for quotes:
 * - Unwraps hard line breaks inside paragraphs into spaces
 * - Preserves paragraph breaks (blank lines)
 * - Best-effort de-hyphenation for wrapped words
 */
export function formatOcrText(raw: string): string {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";

  const blocks = normalized.split(/\n{2,}/);
  const formatted = blocks.map((block) => joinWrappedLines(block.split("\n"))).filter(Boolean);

  return formatted.join("\n\n").trim();
}
