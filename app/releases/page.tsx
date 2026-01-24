import { Metadata } from "next";
import { ReleasesList } from "./ReleasesList";
import { getReleases } from "./lib";

export const metadata: Metadata = {
  title: "Releases | bibliomnomnom",
  description: "See what's new in bibliomnomnom - the book tracker for voracious readers",
};

// Revalidate every hour
export const revalidate = 3600;

export default async function ReleasesPage() {
  const releases = await getReleases();

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-12 text-center">
          <h1 className="font-serif text-4xl font-bold text-ink">Releases</h1>
          <p className="mt-4 text-lg text-ink/70">
            Every update to your reading companion, documented.
          </p>
        </header>

        {releases.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-ink/60">No releases yet. Stay tuned!</p>
          </div>
        ) : (
          <ReleasesList releases={releases} />
        )}
      </div>
    </main>
  );
}
