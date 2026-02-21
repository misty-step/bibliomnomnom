"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Download, Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toJSON, toCSV, toMarkdown, downloadFile } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";

type ExportFormat = "json" | "csv" | "markdown";

export function ExportButton() {
  const exportData = useQuery(api.books.exportAllData);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: ExportFormat) => {
    if (!exportData) {
      return;
    }

    setIsExporting(true);
    try {
      // Stamp exportedAt at actual download time (not query evaluation time)
      const now = Date.now();
      const d = new Date(now);
      const fileDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dataAtExport = { ...exportData, exportedAt: now };

      if (format === "json") {
        downloadFile(toJSON(dataAtExport), `bibliomnomnom-${fileDate}.json`, "application/json");
      } else if (format === "csv") {
        downloadFile(toCSV(dataAtExport), `bibliomnomnom-${fileDate}.csv`, "text/csv");
      } else {
        downloadFile(toMarkdown(dataAtExport), `bibliomnomnom-${fileDate}.md`, "text/markdown");
      }
    } catch {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" disabled={isExporting || !exportData}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handleExport("json")}>JSON</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport("csv")}>
          CSV (Goodreads-compatible)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport("markdown")}>Markdown</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
