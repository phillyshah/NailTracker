import { describe, it, expect } from 'vitest';
import { parseLabelsFromText } from './ocrBarcode';
import { refToGtinShort, gtinShortToFullGtin } from './gtin-map';

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
});
