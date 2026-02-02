import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Playfair_Display, Geist, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { PostHogPageview } from "@/components/providers/PostHogPageview";
import { PostHogProvider, PostHogIdentify } from "@/components/providers/PostHogProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const fontDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://bibliomnomnom.com"),
  title: {
    default: "bibliomnomnom",
    template: "%s | bibliomnomnom",
  },
  description: "A digital garden for voracious readers",
  manifest: "/manifest.webmanifest",
  openGraph: {
    siteName: "bibliomnomnom",
    type: "website",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "bibliomnomnom - A digital garden for voracious readers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable} flex min-h-screen flex-col font-sans antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <PostHogProvider>
              <PostHogIdentify />
              <ConvexClientProvider>
                <div className="flex-1">{children}</div>
                <Footer />
                <Toaster />
              </ConvexClientProvider>
              <PostHogPageview />
            </PostHogProvider>
            <SpeedInsights />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
