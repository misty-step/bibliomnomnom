import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

import { Masthead } from "@/components/navigation/Masthead";
import { Spine } from "@/components/navigation/Spine";
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

      {/* Noise texture overlay - Paper/Film grain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* Content layer */}
      <div className="relative">
        <Masthead />
        <Spine />
        <main className="px-8 py-12 md:px-16 lg:ml-[var(--layout-spine)] lg:px-24">
          <FadeInContent>{children}</FadeInContent>
        </main>
      </div>
    </div>
  );
}
