import { describe, it, expect } from 'vitest';
import { parseGS1, isParseError } from './parseGS1';

/**
 * Camera/photo scans build the expiry date on the client. It must land on UTC
 * midnight so it matches manual entry and renders the same day everywhere.
 *   TZ=America/New_York npm test --workspace=client
 */
describe('parseGS1 expiry (client)', () => {
  it('parses AI 17 (YYMMDD) expiry to UTC midnight', () => {
    const res = parseGS1('(01)08880089459148(10)J250929-L021(17)300928');
    expect(isParseError(res)).toBe(false);
    if (isParseError(res)) return;
    expect(res.expDate).not.toBeNull();
    expect(res.expDate!.toISOString()).toBe('2030-09-28T00:00:00.000Z');
  });
});
