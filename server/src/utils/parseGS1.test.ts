import { describe, it, expect } from 'vitest';
import { parseGS1, isParseError } from './parseGS1.js';

/**
 * Scanned expiry dates must land on UTC midnight of the labelled day so they
 * render identically in every timezone (the same canonical form manual entry
 * uses). Run under e.g. TZ=America/New_York and TZ=Asia/Tokyo.
 */
describe('parseGS1 expiry date', () => {
  it('parses AI 17 (YYMMDD) expiry to UTC midnight', () => {
    const res = parseGS1('(01)08880089459148(10)J250929-L021(17)300928');
    expect(isParseError(res)).toBe(false);
    if (isParseError(res)) return;
    expect(res.expDate).not.toBeNull();
    expect(res.expDate!.toISOString()).toBe('2030-09-28T00:00:00.000Z');
  });

  it('parses the hourglass YYYY-MM-DD fallback to UTC midnight', () => {
    const res = parseGS1('(01)08880089459148(10)LOT123 2030-09-28');
    expect(isParseError(res)).toBe(false);
    if (isParseError(res)) return;
    expect(res.expDate).not.toBeNull();
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2030-09-28');
  });
});
