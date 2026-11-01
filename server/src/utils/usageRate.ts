/**
 * Usage rate estimation.
 *
 * Splitting this out of the controllers because the arithmetic has a trap in
 * it. The original form was `unitsInWindow / windowMonths` — divide by the
 * nominal window regardless of how much history the item actually has. For a
 * mature product that is fine. For a line that started selling six weeks ago it
 * understates demand by the ratio of window to actual history: six units in a
 * three-month window reads as 2/month when the real rate is 4/month.
 *
 * That matters here because the rate feeds `resolvePar`, so a cover-months par
 * on a ramping product silently under-orders exactly when getting it right
 * matters most.
 *
 * The fix is to divide by the months an item has actually been observed —
 * measured from its first use in the window up to NOW, not to its last use. An
 * item used once three months ago genuinely is a 0.33/month item; an item first
 * used last month is not.
 */

/** Average month in milliseconds — 365.25/12 days. */
const MONTH_MS = 2_629_800_000;

export interface UsageObservation {
  /** Whatever the caller is grouping by, e.g. `itemNumber|distributorId`. */
  key: string;
  usedAt: Date;
}

export interface UsageRate {
  /** Units consumed per month, over the months actually observed. */
  perMonth: number;
  /** Units seen. The evidence behind the rate — show it next to the number. */
  units: number;
  /** Months this key has actually been observed, capped at the window. */
  observedMonths: number;
}

/**
 * Units per month for each key.
 *
 * `observedMonths` is floored at 1: a burst of six units in the last fortnight
 * is reported as 6/month, not 12/month. Extrapolating a partial month up to a
 * full one would make a single busy week look like a permanent demand step.
 */
export function usageRates(
  rows: UsageObservation[],
  windowMonths: number,
  now: Date = new Date(),
): Record<string, UsageRate> {
  const units: Record<string, number> = {};
  const firstSeen: Record<string, number> = {};

  for (const r of rows) {
    const t = r.usedAt.getTime();
    units[r.key] = (units[r.key] ?? 0) + 1;
    if (firstSeen[r.key] === undefined || t < firstSeen[r.key]) firstSeen[r.key] = t;
  }

  const out: Record<string, UsageRate> = {};
  for (const key of Object.keys(units)) {
    const elapsed = (now.getTime() - firstSeen[key]) / MONTH_MS;
    const observedMonths = Math.min(windowMonths, Math.max(1, elapsed));
    out[key] = {
      perMonth: +(units[key] / observedMonths).toFixed(2),
      units: units[key],
      observedMonths: +observedMonths.toFixed(1),
    };
  }
  return out;
}

/** Just the rates, for callers that don't need the evidence alongside. */
export function ratesPerMonth(
  rows: UsageObservation[],
  windowMonths: number,
  now: Date = new Date(),
): Record<string, number> {
  const full = usageRates(rows, windowMonths, now);
  const out: Record<string, number> = {};
  for (const k of Object.keys(full)) out[k] = full[k].perMonth;
  return out;
}
