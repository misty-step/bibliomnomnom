"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  username: string;
  isPublic: boolean;
  onToggle: (isPublic: boolean) => Promise<void>;
  isToggling: boolean;
};

/**
 * Modal for sharing reader profile.
 * Shows what's included in public profile and toggle to make public/private.
 */
export function ShareModal({
  open,
  onClose,
  username,
  isPublic,
  onToggle,
  isToggling,
}: ShareModalProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/readers/${username}`
      : `/readers/${username}`;

  const handleToggle = async () => {
    if (isPublic) {
      // Warn before making private
      setShowWarning(true);
    } else {
      await onToggle(true);
    }
  };

  const handleConfirmPrivate = async () => {
    setShowWarning(false);
    await onToggle(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Share it with your friends!",
      });
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Share Your Reader Profile</DialogTitle>
          </DialogHeader>

          {/* What's shared */}
          <div className="space-y-md">
            <div>
              <p className="text-sm font-medium text-text-ink mb-xs">Public profile includes:</p>
              <ul className="text-sm text-text-inkMuted space-y-xs">
                <li className="flex items-center gap-sm">
                  <Check className="w-4 h-4 text-status-success" />
                  Books read count and reading pace
                </li>
                <li className="flex items-center gap-sm">
                  <Check className="w-4 h-4 text-status-success" />
                  AI-generated taste profile
                </li>
                <li className="flex items-center gap-sm">
                  <Check className="w-4 h-4 text-status-success" />
                  Thematic connections and genres
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-medium text-text-ink mb-xs">Never shared:</p>
              <ul className="text-sm text-text-inkMuted space-y-xs">
                <li className="flex items-center gap-sm">
                  <X className="w-4 h-4 text-status-danger" />
                  Individual book titles
                </li>
                <li className="flex items-center gap-sm">
                  <X className="w-4 h-4 text-status-danger" />
                  Your notes and quotes
                </li>
                <li className="flex items-center gap-sm">
                  <X className="w-4 h-4 text-status-danger" />
                  Reading dates and activity
                </li>
              </ul>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between py-sm border-t border-b border-line-ghost">
            <div>
              <p className="text-sm font-medium text-text-ink">
                {isPublic ? "Profile is public" : "Make profile public"}
              </p>
              <p className="text-xs text-text-inkMuted">
                {isPublic ? "Anyone with the link can view" : "Generate a shareable link"}
              </p>
            </div>
            <Button
              variant={isPublic ? "secondary" : "primary"}
              size="sm"
              onClick={handleToggle}
              disabled={isToggling}
            >
              {isToggling ? "..." : isPublic ? "Make Private" : "Make Public"}
            </Button>
          </div>

          {/* Share URL (only when public) */}
          {isPublic && (
            <div className="flex gap-sm">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-sm py-xs bg-canvas-boneMuted rounded text-sm text-text-ink border-none outline-none"
              />
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Warning when making private */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make profile private?</AlertDialogTitle>
            <AlertDialogDescription>
              This will break any existing shared links. Anyone who has the link will no longer be
              able to view your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPrivate}>Yes, make private</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
