import { describe, it, expect, afterEach } from 'vitest';
import {
  parseLabelsFromText,
  parseLabelsDetailed,
  levenshtein,
  toGrayscale,
  stretchContrast,
  otsuThreshold,
  adaptiveThreshold,
  NORMALIZED_CATALOG,
} from './ocrBarcode';
import {
  refToGtinShort,
  gtinShortToFullGtin,
  setAliasOverlay,
  clearAliasOverlay,
} from './gtin-map';

/** Build the GS1 string we expect for a catalogued REF. */
function expected(ref: string, lot: string, exp?: string): string {
  const gtin = gtinShortToFullGtin(refToGtinShort[ref.toUpperCase()]);
  return exp ? `(01)${gtin}(10)${lot}(17)${exp}` : `(01)${gtin}(10)${lot}`;
}

describe('parseLabelsFromText', () => {
  it('reads a single implant sticker (REF / LOT / hourglass date)', () => {
    const text = [
      'REF SO-S50I-SO-044-T',
      'LOT J251021-L015',
      'Summa Orthopaedics Femur Nail System',
      'Interlocking Screw 44 x Ø6 mm',
      '2030-10-20',
    ].join('\n');

    expect(parseLabelsFromText(text)).toEqual([
      expected('SO-S50I-SO-044-T', 'J251021-L015', '301020'),
    ]);
  });

  it('reads every sticker from a multi-label photo', () => {
    const text = [
      'REF SO-SPFN-0380-10L-30',
      'LOT J250929-L056',
      'Summa Orthopaedics Femur Nail System',
      'Long Nail 380 x Ø10 mm Left 130°',
      '2030-09-28',
      '',
      'REF SO-SPFS-000',
      'LOT J280928-L009',
      'Summa Orthopaedics Femur Nail System',
      'Set Screw',
      '2030-09-28',
      '',
      'REF SO-SPFL-N100',
      'LOT J250929-L016',
      'Summa Orthopaedics Femur Nail System',
      'Lag Screw(Normal) 100 mm',
      '2030-09-28',
      '',
      'REF SO-S50I-SO-044-T',
      'LOT J251021-L015',
      'Summa Orthopaedics Femur Nail System',
      'Interlocking Screw 44 x Ø6 mm',
      '2030-10-20',
    ].join('\n');

    expect(parseLabelsFromText(text)).toEqual([
      expected('SO-SPFN-0380-10L-30', 'J250929-L056', '300928'),
      expected('SO-SPFS-000', 'J280928-L009', '300928'),
      expected('SO-SPFL-N100', 'J250929-L016', '300928'),
      expected('SO-S50I-SO-044-T', 'J251021-L015', '301020'),
    ]);
  });

  it('tolerates common OCR character confusions in the REF code', () => {
    // O↔0 and I↔1 swaps that Tesseract frequently makes on this label.
    const text = ['REF S0-S5OI-SO-O44-T', 'LOT J251021-L015', '2030-10-20'].join('\n');
    expect(parseLabelsFromText(text)).toEqual([
      expected('SO-S50I-SO-044-T', 'J251021-L015', '301020'),
    ]);
  });

  it('emits a label even when the expiry is unreadable', () => {
    const text = ['REF SO-SPFC-010', 'LOT A123-B45'].join('\n');
    expect(parseLabelsFromText(text)).toEqual([expected('SO-SPFC-010', 'A123-B45')]);
  });

  it('skips a REF with no lot (nothing to match in inventory)', () => {
    expect(parseLabelsFromText('REF SO-SPFC-010\nInterlocking Screw')).toEqual([]);
  });

  it('returns nothing when no catalogued REF is present', () => {
    expect(parseLabelsFromText('Place Implant Label here\nPrice: $295')).toEqual([]);
  });

  it('does not double-count a REF that contains a second "SO" token', () => {
    // SO-S50I-SO-044-T has two "SO"s; it must produce exactly one label.
    const text = 'REF SO-S50I-SO-044-T LOT J251021-L015 2030-10-20';
    expect(parseLabelsFromText(text)).toHaveLength(1);
  });

  it('counts two identical stickers as two units (no over-dedup)', () => {
    const sticker = ['REF SO-SPFC-010', 'LOT A123-B45', '2030-10-20'];
    const text = [...sticker, '', ...sticker].join('\n');
    const out = parseLabelsFromText(text);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(expected('SO-SPFC-010', 'A123-B45', '301020'));
    expect(out[1]).toBe(out[0]);
  });

  it('prefers a labeled EXP over an earlier manufacture date', () => {
    const text = ['REF SO-SPFC-010', 'LOT A123-B45', 'MFG 2025-01-01', 'EXP 2030-10-20'].join('\n');
    expect(parseLabelsFromText(text)).toEqual([expected('SO-SPFC-010', 'A123-B45', '301020')]);
  });

  it('with two unlabeled dates, takes the later one as the expiry', () => {
    const text = ['REF SO-SPFC-010', 'LOT A123-B45', '2025-01-01', '2030-10-20'].join('\n');
    expect(parseLabelsFromText(text)).toEqual([expected('SO-SPFC-010', 'A123-B45', '301020')]);
  });

  it('recovers extra OCR confusions (B↔8, G↔6, T↔7, D↔0) in the REF', () => {
    // OCR mangled SO-S50I-SO-080-T as ...0B0-7 (8→B) and SO→S0.
    const text = ['REF S0-S50I-S0-0B0-7', 'LOT J251021-L015', '2030-10-20'].join('\n');
    expect(parseLabelsFromText(text)).toEqual([
      expected('SO-S50I-SO-080-T', 'J251021-L015', '301020'),
    ]);
  });
});

describe('catalog normalization', () => {
  it('keeps every normalized REF code collision-free after the OCR folds', () => {
    const seen = new Map<string, string>();
    for (const { norm, ref } of NORMALIZED_CATALOG) {
      const prev = seen.get(norm);
      expect(prev, `"${ref}" and "${prev}" both normalize to "${norm}"`).toBeUndefined();
      seen.set(norm, ref);
    }
  });
});

describe('parseLabelsDetailed', () => {
  it('returns structured fields alongside the GS1 string', () => {
    const text = ['REF SO-SPFC-010', 'LOT A123-B45', 'EXP 2030-10-20'].join('\n');
    expect(parseLabelsDetailed(text)).toEqual([
      {
        ref: 'SO-SPFC-010',
        gtin: gtinShortToFullGtin(refToGtinShort['SO-SPFC-010']),
        lot: 'A123-B45',
        exp: '301020',
        gs1: expected('SO-SPFC-010', 'A123-B45', '301020'),
      },
    ]);
  });
});

describe('levenshtein', () => {
  it('measures single edits and bails past the cap', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('abc', 'abd')).toBe(1);
    expect(levenshtein('abc', 'xyz', 1)).toBe(2); // exceeds cap → max + 1
  });
});

describe('OCR alias overlay feedback', () => {
  afterEach(() => clearAliasOverlay());

  it('resolves a mis-read token the matcher would otherwise miss', () => {
    // "SO-AAAA-BBBB" is far too garbled to fuzzy-match on its own.
    const stray = 'REF SO-AAAA-BBBB\nLOT A123-B45\n2030-10-20';
    expect(parseLabelsFromText(stray)).toEqual([]);

    setAliasOverlay([{ token: 'SO-AAAA-BBBB', canonicalRef: 'SO-SPFC-010' }]);
    expect(parseLabelsFromText(stray)).toEqual([
      expected('SO-SPFC-010', 'A123-B45', '301020'),
    ]);
  });

  it('ignores aliases pointing at a REF that isn\'t in the catalog', () => {
    setAliasOverlay([{ token: 'SO-AAAA-BBBB', canonicalRef: 'SO-NOPE-999' }]);
    expect(parseLabelsFromText('REF SO-AAAA-BBBB\nLOT A123-B45')).toEqual([]);
  });
});

describe('image preprocessing helpers', () => {
  /** Build an N-pixel RGBA buffer from gray values. */
  function rgba(grays: number[]): Uint8ClampedArray {
    const out = new Uint8ClampedArray(grays.length * 4);
    grays.forEach((g, i) => {
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = g;
      out[i * 4 + 3] = 255;
    });
    return out;
  }

  it('toGrayscale collapses RGBA to one luma value per pixel', () => {
    const gray = toGrayscale(rgba([0, 128, 255]));
    expect(Array.from(gray)).toEqual([0, 128, 255]);
  });

  it('stretchContrast expands a dim range to the full 0–255', () => {
    const out = stretchContrast(Uint8ClampedArray.from([100, 120, 140]));
    expect(out[0]).toBe(0);
    expect(out[2]).toBe(255);
  });

  it('otsuThreshold separates a clearly bimodal image', () => {
    const gray = Uint8ClampedArray.from([10, 10, 10, 240, 240, 240]);
    const t = otsuThreshold(gray);
    expect(t).toBeGreaterThanOrEqual(10);
    expect(t).toBeLessThan(240);
  });

  it('adaptiveThreshold keeps dark text on a light field as black pixels', () => {
    // 4×4 light field (200) with a dark "letter" pixel (20) in the middle.
    const grays = new Array(16).fill(200);
    grays[5] = 20;
    const bin = adaptiveThreshold(Uint8ClampedArray.from(grays), 4, 4, 3, 8);
    expect(bin[5]).toBe(0); // dark pixel → black
    expect(bin[0]).toBe(255); // background → white
  });
});
