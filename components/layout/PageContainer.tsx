/**
 * Standard page container with responsive horizontal padding.
 * Use for pages that don't need full-bleed sections.
 *
 * Pages like /profile that use full-bleed background sections
 * should NOT use this wrapper - they handle their own padding
 * via internal content containers (e.g., max-w-4xl mx-auto px-md).
 */
export function PageContainer({ children }: { children: React.ReactNode }) {
  return <div className="px-6 sm:px-8 md:px-12 lg:px-16">{children}</div>;
}
