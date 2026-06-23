import { describe, it, expect } from 'vitest';
import { fifoCompare, pickFifo, type UsageCandidate } from './usageMatch.js';

/**
 * FIFO selection must be timezone-stable (compares getTime() only). Run under
 * e.g. TZ=America/New_York and TZ=UTC to confirm the same unit is always picked.
 */
const mk = (id: string, exp: string | null, created: string): UsageCandidate => ({
  id,
  expDate: exp ? new Date(exp) : null,
  createdAt: new Date(created),
});

describe('pickFifo', () => {
  it('returns null for an empty list', () => {
    expect(pickFifo([])).toBeNull();
  });

  it('picks the unit with the oldest expiry', () => {
    const a = mk('a', '2031-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    const b = mk('b', '2030-06-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    const c = mk('c', '2032-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    expect(pickFifo([a, b, c])!.id).toBe('b');
  });

  it('sorts a null expiry AFTER any dated unit (consume dated stock first)', () => {
    const dated = mk('dated', '2030-06-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    const undated = mk('undated', null, '2025-01-01T00:00:00.000Z');
    expect(pickFifo([undated, dated])!.id).toBe('dated');
  });

  it('falls back to the oldest createdAt when expiry is equal', () => {
    const older = mk('older', '2030-06-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    const newer = mk('newer', '2030-06-01T00:00:00.000Z', '2026-03-15T00:00:00.000Z');
    expect(pickFifo([newer, older])!.id).toBe('older');
  });

  it('does not mutate the input array', () => {
    const arr = [
      mk('a', '2031-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
      mk('b', '2030-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ];
    const before = arr.map((x) => x.id);
    pickFifo(arr);
    expect(arr.map((x) => x.id)).toEqual(before);
  });
});

describe('fifoCompare', () => {
  it('orders all-null expiries by createdAt', () => {
    const a = mk('a', null, '2026-02-01T00:00:00.000Z');
    const b = mk('b', null, '2026-01-01T00:00:00.000Z');
    expect([a, b].sort(fifoCompare).map((x) => x.id)).toEqual(['b', 'a']);
  });
});
