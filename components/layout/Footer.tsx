import Link from "next/link";

export function Footer() {
  return (
    <footer className="py-8">
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-6">
          <Link
            href="/pricing"
            className="font-mono text-xs text-text-inkSubtle transition-colors hover:text-text-inkMuted"
          >
            Pricing
          </Link>
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
