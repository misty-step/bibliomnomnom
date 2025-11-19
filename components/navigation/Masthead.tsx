"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useState, Fragment } from "react"; // Import useState and Fragment
import { Dialog, Transition } from "@headlessui/react"; // Import Dialog and Transition
import { Spine } from "./Spine"; // Import Spine

export function Masthead() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="relative z-10 flex h-20 items-center justify-between border-b border-line-ember px-8 py-4 md:px-16 lg:px-24">
      <div className="flex items-center gap-4">
        {/* Hamburger Icon for Mobile/Tablet */}
        <button
          type="button"
          className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-text-ink lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Open main menu</span>
          {/* Hamburger SVG icon */}
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>

        <Link href="/library" className="font-display text-4xl leading-none text-text-ink">
          bibliomnomnom
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <UserButton afterSignOutUrl="/" />
      </div>

      {/* Mobile Menu Overlay */}
      <Transition.Root show={mobileMenuOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setMobileMenuOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-ink/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-auto flex h-full w-full max-w-xs flex-col overflow-y-auto bg-canvas-bone px-6 pb-12 shadow-xl">
                <div className="flex items-center justify-between">
                  <Link href="/library" className="font-display text-4xl leading-none text-text-ink">
                    bibliomnomnom
                  </Link>
                  <button
                    type="button"
                    className="-m-2.5 rounded-md p-2.5 text-text-ink"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="sr-only">Close menu</span>
                    {/* Close icon SVG */}
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-6">
                  <Spine isMobileOverlay={true} onClose={() => setMobileMenuOpen(false)} />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </header>
  );
}
