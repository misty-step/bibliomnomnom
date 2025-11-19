"use client";

import { Fragment, type ReactNode } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { cn } from "@/lib/utils";

type SideSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  description?: string;
};

export function SideSheet({
  open,
  onOpenChange,
  children,
  title,
  description,
}: SideSheetProps) {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onOpenChange}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-text-ink/50 transition-opacity" />
        </Transition.Child>

                  <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
                        <Transition.Child
                          as={Fragment}
                          enter="transform transition ease-in-out duration-300 sm:duration-500"
                          enterFrom="translate-x-full"
                          enterTo="translate-x-0"
                          leave="transform transition ease-in-out duration-200 sm:duration-300"
                          leaveFrom="translate-x-0"
                          leaveTo="translate-x-full"
                        >
                          <Dialog.Panel className="pointer-events-auto w-screen max-w-full md:max-w-md shadow-[-8px_0_24px_rgba(0,0,0,0.1)]">
                            <div className="flex h-full flex-col overflow-y-scroll bg-canvas-bone py-6">
                              <div className="px-4 sm:px-6">
                                <div className="flex items-start justify-between">
                                  <Dialog.Title className="font-display text-xl text-ink">
                                    {title}
                                  </Dialog.Title>
                                  <div className="ml-3 flex h-7 items-center">
                                    <button
                                      type="button"
                                      className="relative rounded-md text-text-inkMuted hover:text-text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                                      onClick={() => onOpenChange(false)}
                                    >
                                      <span className="absolute -inset-2.5" />
                                      <span className="sr-only">Close panel</span>
                                      ✕
                                    </button>
                                  </div>
                                </div>
                                {description && (
                                  <Dialog.Description className="mt-1 text-sm text-text-inkMuted">
                                    {description}
                                  </Dialog.Description>
                                )}
                              </div>
                              <div className="relative mt-6 flex-1 px-4 sm:px-6">
                                {children}
                              </div>
                            </div>
                          </Dialog.Panel>
                        </Transition.Child>
                      </div>
                    </div>
                  </div>      </Dialog>
    </Transition.Root>
  );
}