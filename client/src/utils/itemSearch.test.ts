import { describe, it, expect } from 'vitest';
import { textMatch, matchesItemSearch, type SearchableItem } from './itemSearch';

const item: SearchableItem = {
  itemNumber: 'SO-SPFN-0380-10L-30',
  lot: 'J250929-L021',
  productLabel: 'Short Nail 380mm Left',
  udi: '9461479-J250929-L021',
  gtinShort: '9461479',
};

describe('textMatch', () => {
  it('matches everything when the query is empty or whitespace', () => {
    expect(textMatch('', 'abc')).toBe(true);
    expect(textMatch('   ', 'abc')).toBe(true);
  });

  it('is case-insensitive and matches substrings', () => {
    expect(textMatch('spfn', 'SO-SPFN-0380')).toBe(true);
    expect(textMatch('NAIL', 'Short Nail 380mm')).toBe(true);
  });

  it('returns false when no field contains the query', () => {
    expect(textMatch('zzz', 'abc', 'def')).toBe(false);
  });

  it('is null/undefined-safe', () => {
    expect(textMatch('abc', null, undefined)).toBe(false);
    expect(textMatch('', null, undefined)).toBe(true);
  });
});

describe('matchesItemSearch', () => {
  it('matches by item number / REF', () => {
    expect(matchesItemSearch(item, '0380-10l')).toBe(true);
  });

  it('matches by lot', () => {
    expect(matchesItemSearch(item, 'l021')).toBe(true);
  });

  it('matches by product label', () => {
    expect(matchesItemSearch(item, 'left')).toBe(true);
  });

  it('matches by UDI and gtinShort', () => {
    expect(matchesItemSearch(item, '9461479')).toBe(true);
  });

  it('returns false for a non-match', () => {
    expect(matchesItemSearch(item, 'cap screw')).toBe(false);
  });

  it('returns true for an empty query (shows all)', () => {
    expect(matchesItemSearch(item, '')).toBe(true);
  });

  it('tolerates items with missing fields', () => {
    expect(matchesItemSearch({ lot: 'ABC' }, 'abc')).toBe(true);
    expect(matchesItemSearch({}, 'abc')).toBe(false);
  });
});
