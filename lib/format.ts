/**
 * Returns singular or plural form based on count.
 * @example pluralize(1, "book") // "book"
 * @example pluralize(3, "book") // "books"
 * @example pluralize(2, "child", "children") // "children"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
