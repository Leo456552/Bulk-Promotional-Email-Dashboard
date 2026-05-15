/** Server-side CSV staging / import limits (design-flow Phase 1). */

/** Max upload size for a single CSV file (bytes). */
export const CSV_MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MiB

/** Max data rows imported in one commit (excluding header). */
export const CSV_MAX_ROWS = 100_000;

/** Rows returned in preview response for the UI table. */
export const CSV_PREVIEW_ROW_CAP = 40;

/** Rows used for auto-detecting which column holds email addresses. */
export const CSV_INFER_SAMPLE_CAP = 200;

/** Staging session lifetime (ms). After this the temp file may be deleted. */
export const CSV_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
