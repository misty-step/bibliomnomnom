import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

type DashboardLayoutProps = {
  children: ReactNode;
};

const links = [
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-border bg-paper-secondary/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/library" className="font-serif text-2xl text-leather">
            bibliomnomnom
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-ink-faded">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 transition hover:bg-paper hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <p className="font-semibold text-ink">{user.firstName ?? "Reader"}</p>
              <p className="text-ink-faded">{user.emailAddresses[0]?.emailAddress}</p>
            </div>
            <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
