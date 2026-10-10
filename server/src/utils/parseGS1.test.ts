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

/**
 * Helper: parse and return the success payload, failing loudly on a parse error.
 */
function ok(code: string) {
  const res = parseGS1(code);
  if (isParseError(res)) throw new Error(`unexpected parse error for ${code}: ${res.error}`);
  return res;
}

/**
 * Regression for the batch-upload corruption: a raw GS1 stream whose LOT
 * contains the digits "17" (or "10") must not be split on those digits. The
 * lot is variable-length; the real AI 17 (expiry) is the trailing "17"+YYMMDD.
 */
describe('parseGS1 raw stream — variable-length lot disambiguation', () => {
  it('does not split the lot on a "17" that lives inside the lot (the reported bug)', () => {
    // "J260225-L170" contains "17" in "L170"; the old parser cut the lot to
    // "J260225-L" and read "017310" as the date (month 73 → JS overflow to 2007).
    const res = ok('010880008946147910J260225-L17017310224');
    expect(res.lot).toBe('J260225-L170');
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2031-02-24');
    expect(res.udi).toBe('9461479-J260225-L170');
    // Explicitly assert the old wrong values can no longer occur.
    expect(res.lot).not.toBe('J260225-L');
    expect(res.expDate!.getUTCFullYear()).not.toBe(2007);
  });

  it('does not split the lot on a "10" inside the lot', () => {
    const res = ok('0108800089459148' + '10' + 'X10Y-22' + '17' + '301231');
    expect(res.lot).toBe('X10Y-22');
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2030-12-31');
  });

  it('handles a lot containing "17" with no expiry present (lot runs to the end)', () => {
    const res = ok('0108800089459148' + '10' + 'ABC170DEF');
    expect(res.lot).toBe('ABC170DEF');
    expect(res.expDate).toBeNull();
  });

  it('parses expiry-before-lot order (AI 17 then AI 10)', () => {
    const res = ok('0108800089459148' + '17' + '301231' + '10' + 'LOT-9');
    expect(res.lot).toBe('LOT-9');
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2030-12-31');
  });

  it('uses an FNC1 (GS) separator to end the lot unambiguously', () => {
    const GS = String.fromCharCode(29);
    // Lot ends in "LOT17" — only the GS separator marks the true field boundary.
    const res = ok('0108800089459148' + '10' + 'LOT17' + GS + '17' + '301231');
    expect(res.lot).toBe('LOT17');
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2030-12-31');
  });

  it('skips a fixed-length production date (AI 11) it does not store', () => {
    const res = ok('0108800089459148' + '11' + '300101' + '10' + 'LOTX');
    expect(res.lot).toBe('LOTX');
  });

  it('treats AI 17 dd=00 as the last day of the month', () => {
    const res = ok('0108800089459148' + '10' + 'LOTX' + '17' + '300900');
    expect(res.expDate!.toISOString().slice(0, 10)).toBe('2030-09-30');
  });

  it('rejects a stream with no valid GTIN', () => {
    const res = parseGS1('10JUSTALOT17301231');
    expect(isParseError(res)).toBe(true);
  });
});

/**
 * Data-driven check over every distinct barcode from the real spreadsheet that
 * triggered the bug report (Lag_Screw_Restocks). Each is the well-formed
 * 01<gtin>10<lot>17<yymmdd> form; the expected lot/expiry are derived by a
 * plain structural split, independent of parseGS1.
 */
describe('parseGS1 — real Lag Screw restock barcodes', () => {
  const cases = [
    { code: '010880008946137010J260225-L16917310224', lot: 'J260225-L169', exp: '2031-02-24' },
    { code: '010880008946138710J260127-L04117310126', lot: 'J260127-L041', exp: '2031-01-26' },
    { code: '010880008946139410J260127-L04217310126', lot: 'J260127-L042', exp: '2031-01-26' },
    { code: '010880008946139410J260127-L04317310126', lot: 'J260127-L043', exp: '2031-01-26' },
    { code: '010880008946140010J260127-L04417310126', lot: 'J260127-L044', exp: '2031-01-26' },
    { code: '010880008946140010J260127-L04517310126', lot: 'J260127-L045', exp: '2031-01-26' },
    { code: '010880008946141710J260127-L04617310126', lot: 'J260127-L046', exp: '2031-01-26' },
    { code: '010880008946141710J260127-L04717310126', lot: 'J260127-L047', exp: '2031-01-26' },
    { code: '010880008946142410J260127-L04817310126', lot: 'J260127-L048', exp: '2031-01-26' },
    { code: '010880008946142410J260127-L04917310126', lot: 'J260127-L049', exp: '2031-01-26' },
    { code: '010880008946143110J260127-L05017310126', lot: 'J260127-L050', exp: '2031-01-26' },
    { code: '010880008946143110J260127-L05117310126', lot: 'J260127-L051', exp: '2031-01-26' },
    { code: '010880008946144810J260127-L05217310126', lot: 'J260127-L052', exp: '2031-01-26' },
    { code: '010880008946145510J260127-L05317310126', lot: 'J260127-L053', exp: '2031-01-26' },
    { code: '010880008946146210J260127-L05417310126', lot: 'J260127-L054', exp: '2031-01-26' },
    { code: '010880008946146210J260127-L05517310126', lot: 'J260127-L055', exp: '2031-01-26' },
    { code: '010880008946147910J260225-L17017310224', lot: 'J260225-L170', exp: '2031-02-24' },
  ];

  for (const c of cases) {
    it(`parses ${c.lot} / ${c.exp}`, () => {
      const res = ok(c.code);
      expect(res.lot).toBe(c.lot);
      expect(res.expDate!.toISOString().slice(0, 10)).toBe(c.exp);
    });
  }
});
