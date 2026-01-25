import Link from "next/link";

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

export function Footer() {
  return (
    <footer className="border-t border-line-ghost/30 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <a
            href="https://mistystep.io"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-text-inkSubtle transition-colors hover:text-text-inkMuted"
          >
            a misty step project
          </a>
          <Link
            href="/releases"
            className="font-mono text-xs text-text-inkSubtle transition-colors hover:text-text-inkMuted"
          >
            v{appVersion}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="font-mono text-xs text-text-inkSubtle transition-colors hover:text-text-inkMuted"
          >
            pricing
          </Link>
          <a
            href="mailto:hello@mistystep.io"
            className="font-mono text-xs text-text-inkSubtle transition-colors hover:text-text-inkMuted"
          >
            feedback
          </a>
        </div>
      </div>
    </footer>
  );
}
