import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import { Masthead } from "@/components/navigation/Masthead";
import { Spine } from "@/components/navigation/Spine";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="relative min-h-screen bg-canvas-bone">
      {/* Radial gradient background - subtle reading light */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, var(--color-canvas-bone) 0%, var(--color-canvas-bone-muted) 100%)",
        }}
      />

      {/* Dot pattern texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%231C1917'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* Content layer */}
      <div className="relative">
        <Masthead />
        <Spine />
        <main className="ml-[var(--layout-spine)] px-8 py-12 md:px-16 lg:px-24">{children}</main>
      </div>
    </div>
  );
}
