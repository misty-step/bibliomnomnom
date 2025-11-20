import { collapseWhitespace, normalizeIsbn, normalizeOptionalText } from "./types";

const STRIP_PUNCTUATION = /[^\p{L}\p{N}]+/gu;
const STRIP_DIACRITICS = /[\u0300-\u036f]/g;

export const normalizeAscii = (value: string): string => {
  const folded = value.normalize("NFD").replace(STRIP_DIACRITICS, "");
  return collapseWhitespace(folded.replace(STRIP_PUNCTUATION, " ").toLowerCase());
};

export const normalizeTitleAuthorKey = (title: string, author: string): string => {
  return `${normalizeAscii(title)}|${normalizeAscii(author)}`;
};

export const normalizeApiId = (value?: string | null): string | undefined =>
  normalizeOptionalText(value)?.toLowerCase();

export { normalizeIsbn };
