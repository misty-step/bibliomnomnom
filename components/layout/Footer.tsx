import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-line-ghost py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/pricing"
            className="font-mono text-sm text-text-inkMuted transition-colors hover:text-text-ink"
          >
            Pricing
          </Link>
          <span className="text-line-ember">·</span>
          <a
            href="mailto:hello@bibliomnomnom.com"
            className="font-mono text-sm text-text-inkMuted transition-colors hover:text-text-ink"
          >
            Contact
          </a>
        </div>
        <a
          href="https://mistystep.io"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-text-inkSubtle transition-colors hover:text-text-inkMuted"
        >
          a misty step project
        </a>
      </div>
    </footer>
  );
}
