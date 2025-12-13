export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Base64 expands by ~4/3, plus data URL prefix overhead.
export const MAX_BASE64_CHARS = Math.ceil(MAX_IMAGE_BYTES * (4 / 3)) + 1024;
