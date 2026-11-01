import { describe, it, expect } from 'vitest';
import { asArray } from './asArray';

describe('asArray', () => {
  it('passes a real array through unchanged', () => {
    const xs = [{ id: 'a' }, { id: 'b' }];
    expect(asArray(xs)).toBe(xs);
  });

  it('returns [] for an empty array', () => {
    expect(asArray([])).toEqual([]);
  });

  // The cases that used to crash a page: `= []` destructuring defaults only
  // cover `undefined`, so these reached `.map()` and threw.
  it('returns [] for null', () => {
    expect(asArray(null)).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(asArray(undefined)).toEqual([]);
  });

  it('returns [] for a non-array object', () => {
    expect(asArray({ a: 1 })).toEqual([]);
  });

  it('returns [] for a string, number, or boolean', () => {
    expect(asArray('nope')).toEqual([]);
    expect(asArray(42)).toEqual([]);
    expect(asArray(true)).toEqual([]);
  });
});
