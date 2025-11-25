"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportFlow } from "@/components/import/ImportFlow";
import { Button } from "@/components/ui/button";

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/library">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>
        </Button>
      </div>

      {/* Import Flow */}
      <ImportFlow />
    </div>
  );
}
