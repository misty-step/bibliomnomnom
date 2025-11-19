import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import { Masthead } from "@/components/navigation/Masthead";
import { FadeInContent } from "@/components/layout/FadeInContent";

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

      {/* Content layer */}
      <div className="relative">
        <Masthead />
        <main className="px-6 py-8 sm:px-8 md:px-12 lg:px-16">
          <FadeInContent>{children}</FadeInContent>
        </main>
      </div>
    </div>
  );
}
