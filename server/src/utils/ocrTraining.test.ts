import { describe, it, expect } from 'vitest';
import { deriveAliases } from './ocrTraining.js';

describe('deriveAliases', () => {
  it('captures a genuine mis-read as a token → REF alias', () => {
    expect(
      deriveAliases([{ token: 'SO-AAAA-BBBB', ref: 'SO-SPFC-010' }]),
    ).toEqual([{ token: 'SO-AAAA-BBBB', canonicalRef: 'SO-SPFC-010' }]);
  });

  it('skips a label whose token already equals its REF (nothing to learn)', () => {
    expect(deriveAliases([{ token: 'SO-SPFC-010', ref: 'SO-SPFC-010' }])).toEqual([]);
    // Separators / case differences are not a mis-read either.
    expect(deriveAliases([{ token: 'so spfc 010', ref: 'SO-SPFC-010' }])).toEqual([]);
  });

  it('skips entries missing a token or a REF', () => {
    expect(deriveAliases([{ token: 'SO-AAAA-BBBB' }, { ref: 'SO-SPFC-010' }, {}])).toEqual([]);
  });

  it('upper-cases the REF and de-duplicates by normalized token', () => {
    expect(
      deriveAliases([
        { token: 'SO-AAAA-BBBB', ref: 'so-spfc-010' },
        { token: 'so aaaa bbbb', ref: 'SO-SPFS-000' }, // same token normalized → dropped
      ]),
    ).toEqual([{ token: 'SO-AAAA-BBBB', canonicalRef: 'SO-SPFC-010' }]);
  });

  it('tolerates null / undefined input', () => {
    expect(deriveAliases(null)).toEqual([]);
    expect(deriveAliases(undefined)).toEqual([]);
  });
});
