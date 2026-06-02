import { describe, it, expect } from 'vitest';
import { parseDateOnly } from './date.js';

/**
 * Regression tests for the manual-entry expiry off-by-one bug.
 *
 * Root cause: `new Date("YYYY-MM-DD")` parses as UTC midnight, so in a
 * negative-offset timezone it renders as the previous calendar day. The scan
 * path builds dates with `new Date(year, month, day)` (local midnight), so
 * parseDateOnly must do the same for bare calendar dates.
 *
 * Run under a negative-offset zone to exercise the bug:
 *   TZ=America/New_York npx vitest run src/utils/date.test.ts
 */
describe('parseDateOnly', () => {
  it('interprets a bare YYYY-MM-DD at LOCAL midnight (preserves the calendar day)', () => {
    const d = parseDateOnly('2030-09-28')!;
    expect(d).not.toBeNull();
    // The day the user typed must survive — regardless of the runner's timezone.
    expect(d.getFullYear()).toBe(2030);
    expect(d.getMonth()).toBe(8); // September (0-indexed)
    expect(d.getDate()).toBe(28);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('matches the scan path exactly (new Date(y, m-1, d))', () => {
    // parseGS1 builds expiry as new Date(year, month-1, day); manual entry must agree.
    expect(parseDateOnly('2030-09-28')!.getTime()).toBe(new Date(2030, 8, 28).getTime());
    expect(parseDateOnly('2026-01-01')!.getTime()).toBe(new Date(2026, 0, 1).getTime());
  });

  it('fixes the off-by-one vs. the old naive new Date(string) in non-UTC zones', () => {
    const fixed = parseDateOnly('2030-09-28')!;
    const naive = new Date('2030-09-28'); // the old buggy behavior (UTC midnight)
    const offsetMinutes = fixed.getTimezoneOffset();

    if (offsetMinutes === 0) {
      // UTC runner: the bug can't manifest, both land on the same instant.
      expect(fixed.getTime()).toBe(naive.getTime());
    } else {
      // Any real timezone: the fixed value differs from the naive UTC parse,
      // and crucially still reports the typed calendar day in local time.
      expect(fixed.getTime()).not.toBe(naive.getTime());
      expect(fixed.getDate()).toBe(28);
    }
  });

  it('passes through full ISO datetime strings unchanged', () => {
    const iso = '2030-09-28T04:00:00.000Z';
    expect(parseDateOnly(iso)!.getTime()).toBe(new Date(iso).getTime());
  });

  it('returns null for empty, whitespace, and nullish input', () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('   ')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseDateOnly('not-a-date')).toBeNull();
  });
});
