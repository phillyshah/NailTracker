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

/**
 * Mirrors the server fix: a raw GS1 stream whose lot contains the digits "17"
 * (or "10") must not be split there. Keeps the camera/photo scan path correct.
 */
describe('parseGS1 raw stream — lot disambiguation (client)', () => {
  function ok(code: string) {
    const res = parseGS1(code);
    if (isParseError(res)) throw new Error(`unexpected parse error: ${res.error}`);
    return res;
  }

  it('does not split the lot on a "17" inside the lot (the reported bug)', () => {
    const res = ok('010880008946147910J260225-L17017310224');
    expect(res.lot).toBe('J260225-L170');
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2031-02-24');
  });

  it('does not split the lot on a "10" inside the lot', () => {
    const res = ok('0108800089459148' + '10' + 'X10Y-22' + '17' + '301231');
    expect(res.lot).toBe('X10Y-22');
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2030-12-31');
  });

  it('parses expiry-before-lot order', () => {
    const res = ok('0108800089459148' + '17' + '301231' + '10' + 'LOT-9');
    expect(res.lot).toBe('LOT-9');
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2030-12-31');
  });
});
