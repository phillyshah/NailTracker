import { describe, it, expect } from 'vitest';
import { formatExpiry, daysUntilExpiry } from './expiry';

/**
 * These tests reproduce the production bug: an expiry stored as UTC midnight
 * ("2030-09-28T00:00:00.000Z") was rendering as Sep 27 in US timezones because
 * toLocaleDateString() used the browser's local zone. formatExpiry pins the
 * render to UTC, so the typed/scanned day shows everywhere.
 *
 * Run the suite under a negative-offset zone to actually exercise the bug:
 *   TZ=America/New_York npm test --workspace=client
 *   TZ=Asia/Tokyo       npm test --workspace=client   (positive offset)
 */
describe('formatExpiry', () => {
  it('shows the stored calendar day, not the local shift (the bug)', () => {
    // UTC-midnight value, exactly what the DB returns for "2030-09-28".
    expect(formatExpiry('2030-09-28T00:00:00.000Z')).toBe('Sep 28, 2030');
  });

  it('is stable across a range of dates and month/year boundaries', () => {
    expect(formatExpiry('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
    expect(formatExpiry('2024-12-31T00:00:00.000Z')).toBe('Dec 31, 2024');
  });

  it('renders a US-scanned value (baked-in offset) on its UTC day', () => {
    // Legacy scanned row stored at local-midnight+offset still has UTC day 28.
    expect(formatExpiry('2030-09-28T04:00:00.000Z')).toBe('Sep 28, 2030');
  });

  it('returns an em dash for null / empty / invalid input', () => {
    expect(formatExpiry(null)).toBe('—');
    expect(formatExpiry(undefined)).toBe('—');
    expect(formatExpiry('')).toBe('—');
    expect(formatExpiry('nonsense')).toBe('—');
  });
});

describe('daysUntilExpiry', () => {
  const today = new Date('2026-06-02T12:00:00.000Z');

  it('counts whole days to a future expiry', () => {
    expect(daysUntilExpiry('2026-06-12T00:00:00.000Z', today)).toBe(10);
  });

  it('returns 0 on the expiry day and negative once past', () => {
    expect(daysUntilExpiry('2026-06-02T00:00:00.000Z', today)).toBe(0);
    expect(daysUntilExpiry('2026-06-01T00:00:00.000Z', today)).toBe(-1);
  });

  it('returns null for missing/invalid input', () => {
    expect(daysUntilExpiry(null, today)).toBeNull();
    expect(daysUntilExpiry('bad', today)).toBeNull();
  });
});
