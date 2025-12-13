export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Base64 expands by ~4/3.
export const MAX_BASE64_PAYLOAD_CHARS = Math.ceil(MAX_IMAGE_BYTES * (4 / 3));

// Data URL prefix overhead (data:image/...;base64,) is small; keep headroom.
export const MAX_DATA_URL_CHARS = MAX_BASE64_PAYLOAD_CHARS + 1024;
