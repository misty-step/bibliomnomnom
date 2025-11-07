import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 bg-paper text-ink font-sans">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold font-serif text-leather">
          bibliomnomnom
        </h1>
        <p className="text-center sm:text-left text-ink-faded text-lg">
          A digital garden for voracious readers
        </p>
        <Button>Get Started</Button>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <p className="text-sm text-ink-faded border-t border-border pt-4">
          Ready to build something beautiful.
        </p>
      </footer>
    </div>
  );
}
