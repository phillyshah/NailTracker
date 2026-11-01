import { describe, it, expect } from 'vitest';
import { parseDateOnly, formatDateOnly, normalizeToUtcMidnight } from './date.js';

/**
 * Regression tests for the manual-entry expiry off-by-one bug.
 *
 * Expiry is stored canonically as UTC midnight of the typed calendar day, so
 * the stored ISO must be "YYYY-MM-DDT00:00:00.000Z" no matter what timezone the
 * server runs in. Run under several zones to prove timezone independence:
 *   TZ=America/New_York npx vitest run src/utils/date.test.ts
 *   TZ=Asia/Tokyo       npx vitest run src/utils/date.test.ts
 */
describe('parseDateOnly', () => {
  it('parses a bare YYYY-MM-DD to UTC midnight, regardless of server timezone', () => {
    const d = parseDateOnly('2030-09-28')!;
    expect(d).not.toBeNull();
    // The exact stored value users round-trip through the DB.
    expect(d.toISOString()).toBe('2030-09-28T00:00:00.000Z');
    expect(d.getUTCFullYear()).toBe(2030);
    expect(d.getUTCMonth()).toBe(8); // September (0-indexed)
    expect(d.getUTCDate()).toBe(28);
  });

  it('keeps the typed calendar day no matter the timezone (the off-by-one fix)', () => {
    // .toISOString() is always UTC, so the date portion is the typed day.
    expect(parseDateOnly('2030-09-28')!.toISOString().slice(0, 10)).toBe('2030-09-28');
    expect(parseDateOnly('2026-01-01')!.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(parseDateOnly('2024-12-31')!.toISOString().slice(0, 10)).toBe('2024-12-31');
  });

  it('matches Date.UTC exactly', () => {
    expect(parseDateOnly('2030-09-28')!.getTime()).toBe(Date.UTC(2030, 8, 28));
    expect(parseDateOnly('2026-01-01')!.getTime()).toBe(Date.UTC(2026, 0, 1));
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

describe('formatDateOnly', () => {
  it('round-trips with parseDateOnly in every timezone', () => {
    for (const input of ['2030-09-28', '2026-01-01', '2024-12-31']) {
      expect(formatDateOnly(parseDateOnly(input)!)).toBe(input);
    }
  });

  it('reads the UTC calendar day (not the local day)', () => {
    expect(formatDateOnly(new Date('2030-09-28T00:00:00.000Z'))).toBe('2030-09-28');
    // An item stored with a baked-in offset still reports its UTC day.
    expect(formatDateOnly(new Date('2030-09-28T23:30:00.000Z'))).toBe('2030-09-28');
  });
});

describe('normalizeToUtcMidnight', () => {
  it('is a no-op for a value already at UTC midnight', () => {
    const d = new Date('2030-09-28T00:00:00.000Z');
    expect(normalizeToUtcMidnight(d).getTime()).toBe(d.getTime());
  });

  it('drops a baked-in time-of-day without shifting the UTC calendar day', () => {
    // A US-scanned item: local midnight Sep 28 EDT == 04:00Z, UTC day is Sep 28.
    const scanned = new Date('2030-09-28T04:00:00.000Z');
    expect(normalizeToUtcMidnight(scanned).toISOString()).toBe('2030-09-28T00:00:00.000Z');
  });
});
