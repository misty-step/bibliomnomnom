"use client";

import { ChangeEvent } from "react";

type SearchBarProps = {
  value: string;
  placeholder?: string;
  isLoading?: boolean;
  onChange: (value: string) => void;
  onClear?: () => void;
};

export function SearchBar({
  value,
  placeholder = "Search for books by title or author…",
  isLoading,
  onChange,
  onClear,
}: SearchBarProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-paper px-4 py-3 pr-16 text-base shadow-sm transition focus:border-leather focus:outline-none focus:ring-2 focus:ring-leather/40"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-12 top-1/2 -translate-y-1/2 text-sm text-ink-faded transition hover:text-ink"
        >
          Clear
        </button>
      ) : null}
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        {isLoading ? <Spinner /> : <MagnifierIcon />}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-leather" />
  );
}

function MagnifierIcon() {
  return (
    <svg
      className="h-4 w-4 text-ink-faded"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m19 19-4-4m-6 2a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z"
      />
    </svg>
  );
}
