const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (s.length === 0 || s.length > 320) return false;
  return EMAIL_RE.test(s);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
