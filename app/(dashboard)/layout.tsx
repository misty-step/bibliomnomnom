import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { DashboardNav } from "@/components/layout/DashboardNav";

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
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        <aside className="hidden w-64 flex-col border-r border-border bg-paper-secondary/70 px-6 py-8 lg:flex">
          <Link href="/library" className="font-serif text-2xl text-leather">
            bibliomnomnom
          </Link>
          <p className="mt-2 text-sm text-ink-faded">
            Beautiful tools for voracious readers.
          </p>
          <div className="mt-6">
            <DashboardNav links={links} orientation="vertical" />
          </div>
          <div className="mt-auto flex items-center gap-3 rounded-2xl border border-border bg-paper p-3">
            <div className="flex-1 text-xs">
              <p className="font-semibold text-ink">{user.firstName ?? "Reader"}</p>
              <p className="text-ink-faded">{user.emailAddresses[0]?.emailAddress}</p>
            </div>
            <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
          </div>
        </aside>
        <div className="flex-1">
          <header className="border-b border-border bg-paper-secondary/60 px-4 py-4 lg:hidden">
            <div className="flex items-center justify-between">
              <Link href="/library" className="font-serif text-2xl text-leather">
                bibliomnomnom
              </Link>
              <UserButton appearance={{ elements: { avatarBox: "h-10 w-10" } }} />
            </div>
            <div className="mt-3">
              <DashboardNav links={links} />
            </div>
          </header>
          <main className="px-4 py-10 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
