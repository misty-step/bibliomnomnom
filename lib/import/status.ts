export type ImportStatus = "want-to-read" | "currently-reading" | "read";

export const DEFAULT_STATUS: ImportStatus = "want-to-read";

const STATUS_ALIASES: Record<string, ImportStatus> = {
  "read": "read",
  "currently-reading": "currently-reading",
  "currently reading": "currently-reading",
  "currently_reading": "currently-reading",
  "to-read": "want-to-read",
  "to read": "want-to-read",
  "want-to-read": "want-to-read",
  "want to read": "want-to-read",
};

export type StatusResolution = {
  status?: ImportStatus;
  warning?: string;
};

const normalizeStatusKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

export const mapShelfToStatus = (raw?: string | null): StatusResolution => {
  if (!raw) return {};

  const normalized = normalizeStatusKey(raw);
  const status = STATUS_ALIASES[normalized];

  if (status) return { status };

  return {
    status: DEFAULT_STATUS,
    warning: `Unrecognized shelf "${raw}"; defaulted to want-to-read`,
  };
};

export const coerceStatus = (raw?: string | null): ImportStatus | undefined =>
  mapShelfToStatus(raw).status;

export const statusOptions: ImportStatus[] = [
  "want-to-read",
  "currently-reading",
  "read",
];
