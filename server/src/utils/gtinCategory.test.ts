import { describe, it, expect } from 'vitest';
import { getProductCategory, PRODUCT_CATEGORIES } from './gtin-map.js';

describe('getProductCategory', () => {
  it('classifies each product type from its REF code', () => {
    const raw = (ref: string) => `(01)08800089459000(10)LOT ${ref}(17)301020`;
    expect(getProductCategory('x', raw('SO-SPFN-0180-10-25'))).toBe('Short Nail');
    expect(getProductCategory('x', raw('SO-SPFN-0300-10L-25'))).toBe('Long Nail'); // side suffix → long
    expect(getProductCategory('x', raw('SO-LPFN-0300-10-25-L'))).toBe('Long Nail');
    expect(getProductCategory('x', raw('SO-SPFL-N70'))).toBe('Lag Screw');
    expect(getProductCategory('x', raw('SO-SPFL-A80'))).toBe('Lag Screw');
    expect(getProductCategory('x', raw('SO-S50I-SO-032-T'))).toBe('Interlocking Screw');
    expect(getProductCategory('x', raw('SO-SPFC-010'))).toBe('Cap Screw');
    expect(getProductCategory('x', raw('SO-SPFS-001'))).toBe('Set Screw');
  });

  it('classifies from gtinShort alone via the catalog (no raw barcode)', () => {
    // 9459148 is catalogued as SO-SPFN-0180-10-25 → Short Nail.
    expect(getProductCategory('9459148')).toBe('Short Nail');
  });

  it('returns Other for an unrecognized item', () => {
    expect(getProductCategory('9999999', 'no ref here')).toBe('Other');
  });

  it('only ever returns one of the defined categories', () => {
    const cat = getProductCategory('9999999', 'no ref here');
    expect(PRODUCT_CATEGORIES).toContain(cat);
  });
});
