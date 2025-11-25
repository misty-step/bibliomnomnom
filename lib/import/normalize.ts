import { collapseWhitespace, normalizeIsbn, normalizeOptionalText } from "./types";

// Remove apostrophes, quotes, hyphens without adding spaces (used in contractions/possessives)
const REMOVE_SILENTLY = /[''\u2019\u2018-]/g;
// Match remaining punctuation and special chars, but NOT letters, numbers, or whitespace
const STRIP_PUNCTUATION = /[^\p{L}\p{N}\s]+/gu;
const STRIP_DIACRITICS = /[\u0300-\u036f]/g;

export const normalizeAscii = (value: string): string => {
  const folded = value.normalize("NFD").replace(STRIP_DIACRITICS, "");
  const noSilent = folded.replace(REMOVE_SILENTLY, "");
  const noPunctuation = noSilent.replace(STRIP_PUNCTUATION, " ");
  return collapseWhitespace(noPunctuation.toLowerCase());
};

export const normalizeTitleAuthorKey = (title: string, author: string): string => {
  return `${normalizeAscii(title)}|${normalizeAscii(author)}`;
};

export const normalizeApiId = (value?: string | null): string | undefined =>
  normalizeOptionalText(value)?.toLowerCase();

export { normalizeIsbn };
