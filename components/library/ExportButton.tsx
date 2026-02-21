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
      const [date] = new Date().toISOString().split("T");
      const fileDate = date ?? "export";

      if (format === "json") {
        downloadFile(toJSON(exportData), `bibliomnomnom-${fileDate}.json`, "application/json");
      } else if (format === "csv") {
        downloadFile(toCSV(exportData), `bibliomnomnom-${fileDate}.csv`, "text/csv");
      } else {
        downloadFile(toMarkdown(exportData), `bibliomnomnom-${fileDate}.md`, "text/markdown");
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
