/**
 * Display helpers for expiry dates.
 *
 * Expiry is a calendar date stored canonically as UTC midnight
 * ("YYYY-MM-DDT00:00:00.000Z" — see server/src/utils/date.ts). It MUST be
 * rendered with `{ timeZone: 'UTC' }`; otherwise `toLocaleDateString()` shifts
 * UTC midnight into the browser's local zone and shows the previous day in the
 * US (the manual-entry off-by-one bug). Keep all expiry rendering in here so
 * there is exactly one place that knows the date is UTC-canonical.
 */

/** Format a stored expiry ISO string as e.g. "Sep 28, 2030" in UTC. */
export function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return '—'; // em dash
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Whole calendar days from today until the expiry date.
 * Negative = already expired, 0 = expires today. Compares the expiry's UTC
 * calendar day against the viewer's local "today", both floored to midnight, so
 * the count is in whole days and never off by a fractional offset.
 */
export function daysUntilExpiry(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const expDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expDay - today) / 86_400_000);
}
