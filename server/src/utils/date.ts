/**
 * Parse a user-supplied expiration date into a Date.
 *
 * A bare calendar date ("YYYY-MM-DD", e.g. from an <input type="date">) is
 * interpreted at LOCAL midnight — matching how scanned GS1 dates are built in
 * parseGS1 (`new Date(year, month, day)`). Using `new Date("YYYY-MM-DD")`
 * directly parses as UTC midnight, which then renders as the previous day in
 * negative-offset timezones — the manual-entry expiry off-by-one bug.
 *
 * Full datetime strings (ISO with a time/zone component) are passed through
 * unchanged. Empty/invalid input yields null.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}
