import { useMemo, useState } from 'react';

type Getter<T> = (item: T) => string | number | null | undefined;

/**
 * Client-side sortable list helper. Pass a map of sortKey -> getter
 * to support nested-field access (e.g. distributor name).
 */
export function useSortable<T>(
  items: T[],
  getters: Record<string, Getter<T>>,
  initialKey: string,
  initialDir: 'asc' | 'desc' = 'asc',
) {
  const [sortKey, setSortKey] = useState(initialKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialDir);

  function toggleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    const get = getters[sortKey];
    if (!get) return items;
    const arr = [...items];
    arr.sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      // Nulls / undefined sort to the bottom regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return arr;
  }, [items, sortKey, sortDir, getters]);

  return { sorted, sortKey, sortDir, toggleSort };
}
