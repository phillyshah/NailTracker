/**
 * Calendar-date handling for expiry dates.
 *
 * Expiry is a *calendar date* (no time, no timezone) but is stored in a
 * `DateTime` column. To keep it from drifting by ±1 day as it crosses server
 * and browser timezones, the whole app uses ONE canonical representation:
 *
 *   UTC midnight of the intended calendar day  →  "YYYY-MM-DDT00:00:00.000Z"
 *
 * Construct it with `Date.UTC(...)` (here and in parseGS1), store it with
 * `.toISOString()`, and ALWAYS render it with `{ timeZone: 'UTC' }` on the
 * client. With every moving part pinned to UTC, the calendar day a user types
 * (or scans) is the calendar day everyone sees, in every timezone.
 *
 * The previous bug: a bare date was parsed with `new Date("YYYY-MM-DD")` (UTC
 * midnight) but rendered with `toLocaleDateString()` (browser-local), so it
 * showed the previous day in negative-offset zones like the US. Pinning both
 * ends to UTC is what actually fixes it — a server-side-only change was a no-op
 * on a UTC server.
 */

/**
 * Parse a user-supplied expiration date into a Date at UTC midnight.
 *
 * A bare "YYYY-MM-DD" (from <input type="date">) becomes UTC midnight of that
 * calendar day, independent of the server's timezone. Full ISO datetime strings
 * are passed through unchanged. Empty/invalid input yields null.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date as a "YYYY-MM-DD" calendar date using its UTC components.
 *
 * Counterpart to parseDateOnly: expiry is canonically UTC midnight, so audit
 * strings and comparisons must read the UTC day — `getFullYear/Month/Date`
 * (local) would land one off in positive-offset timezones.
 */
export function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normalize any stored expiry timestamp to UTC midnight of its UTC calendar
 * day, dropping any time-of-day component. Idempotent: a value already at UTC
 * midnight is returned with the same instant. Used by the backfill endpoint to
 * make legacy rows canonical.
 */
export function normalizeToUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
