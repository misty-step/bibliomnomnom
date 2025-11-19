"use client";

import { Popover as HeadlessPopover, Transition } from "@headlessui/react";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Popover({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <HeadlessPopover className={cn("relative", className)}>
      {children}
    </HeadlessPopover>
  );
}

export function PopoverTrigger({
  children,
  asChild,
  className,
}: {
  children: ReactNode;
  asChild?: boolean; // Headless UI doesn't natively use asChild but we can mimic/ignore or use as='div'
  className?: string;
}) {
  // If asChild is true, we assume the child is an interactive element that handles the click.
  // HeadlessPopover.Button renders a button by default.
  // We'll just render it.
  return (
    <HeadlessPopover.Button as={Fragment as any} className={className}>
      {children}
    </HeadlessPopover.Button>
  );
}

export function PopoverContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Transition
      as={Fragment}
      enter="transition ease-out duration-200"
      enterFrom="opacity-0 translate-y-1"
      enterTo="opacity-100 translate-y-0"
      leave="transition ease-in duration-150"
      leaveFrom="opacity-100 translate-y-0"
      leaveTo="opacity-0 translate-y-1"
    >
      <HeadlessPopover.Panel
        className={cn(
          "absolute left-0 z-10 mt-2 w-56 origin-top-right rounded-xl bg-canvas-bone shadow-lg ring-1 ring-black/5 focus:outline-none",
          className
        )}
      >
        {({ close }) => (
          <div
            onClickCapture={(e) => {
              // Auto-close when a button inside is clicked
              if ((e.target as HTMLElement).closest("button")) {
                close();
              }
            }}
          >
            {children}
          </div>
        )}
      </HeadlessPopover.Panel>
    </Transition>
  );
}