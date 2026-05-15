import path from "path";

export function getUploadsDir(): string {
  return path.join(process.cwd(), "data", "uploads");
}

/** Path to the temp CSV on disk for a staging session. */
export function getSessionAbsolutePath(sessionId: string): string {
  return path.join(getUploadsDir(), `${sessionId}.csv`);
}

/** Value stored in `import_sessions.stored_path` (posix-style, repo-root relative). */
export function getSessionStoredPath(sessionId: string): string {
  return `data/uploads/${sessionId}.csv`;
}
