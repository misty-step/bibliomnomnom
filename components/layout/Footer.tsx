export function Footer() {
  return (
    <footer className="border-t border-line-ghost/30 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-8">
        <a
          href="https://mistystep.io"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-text-inkSubtle transition-colors hover:text-text-inkMuted"
        >
          a misty step project
        </a>
        <a
          href="mailto:hello@mistystep.io"
          className="font-mono text-xs text-text-inkSubtle transition-colors hover:text-text-inkMuted"
        >
          feedback
        </a>
      </div>
    </footer>
  );
}
