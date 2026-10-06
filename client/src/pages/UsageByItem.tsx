import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, PackageSearch } from 'lucide-react';
import { getUsageByItem, getUsageByItemExportUrl } from '../api/reports';
import { SortableTh } from '../components/SortableTh';
import { SearchBar } from '../components/SearchBar';
import { HelpBanner } from '../components/HelpBanner';
import { MiniBars } from '../components/MiniBars';
import { useSortable } from '../hooks/useSortable';
import type { UsageByItemRow } from '../api/reports';

const UNASSIGNED = 'unassigned';

/** Years offered in the picker: this year back to 2024, newest first. */
function yearOptions(): number[] {
  const now = new Date().getUTCFullYear();
  const years: number[] = [];
  for (let y = now; y >= 2024; y--) years.push(y);
  return years;
}

export default function UsageByItem() {
  const navigate = useNavigate();

  // The two time controls are mutually exclusive by construction: `mode` picks
  // which one is live, so only one is ever sent to the API and only one is
  // rendered. Having both visible at once would be ambiguous.
  const [mode, setMode] = useState<'months' | 'year'>('year');
  const [months, setMonths] = useState(12);
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [search, setSearch] = useState('');

  const params = mode === 'year' ? { year } : { months };

  const { data, isLoading } = useQuery({
    queryKey: ['usage-by-item', mode, mode === 'year' ? year : months],
    queryFn: () => getUsageByItem(params),
  });

  // Every array field defaults, per the v3.49 crash fix: a null or unexpected
  // payload must not reach .map(). Memoized because a bare `?? []` mints a new
  // array identity on every render, which would defeat the memos below (and in
  // useSortable) exactly as it did before v3.49.
  const columns = useMemo(() => data?.columns ?? [], [data]);
  const rows = useMemo(() => data?.rows ?? [], [data]);
  // Server-side period totals are available on `data` but the footer deliberately
  // sums the visible rows instead -- see the tfoot comment below.

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.itemNumber.toLowerCase().includes(q) ||
        r.productLabel.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // One getter per dynamic distributor column, memoized on `columns`.
  const getters = useMemo(() => {
    const g: Record<string, (r: UsageByItemRow) => string | number> = {
      itemNumber: (r) => r.itemNumber,
      productLabel: (r) => r.productLabel,
      total: (r) => r.total,
    };
    for (const c of columns) g[c.id] = (r) => r.counts[c.id] ?? 0;
    return g;
  }, [columns]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortable(
    filtered,
    getters,
    'total',
    'desc',
  );

  const topTen = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((r) => ({ label: r.itemNumber, value: r.total })),
    [rows],
  );

  const periodLabel =
    mode === 'year' ? `${year}` : `last ${months} months`;

  function drill(r: UsageByItemRow, columnId: string) {
    const sp = new URLSearchParams({ gtinShort: r.gtinShort });
    if (columnId === UNASSIGNED) sp.set('unassigned', 'true');
    else if (columnId !== 'total') sp.set('distributorId', columnId);
    navigate(`/inventory?${sp.toString()}`);
  }

  return (
    <div className="mx-auto max-w-4xl lg:max-w-7xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={20} /> Back to Reports
        </button>
        <a
          href={getUsageByItemExportUrl(params)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <Download size={18} className="text-primary-600" />
          <span className="hidden sm:inline">Excel</span>
        </a>
      </div>

      <h2 className="text-xl font-bold text-gray-900">Usage by Item Number</h2>

      <HelpBanner storageKey="usage-by-item">
        Units consumed for each item number, broken down by distributor. The <strong>Total</strong>{' '}
        column is the company-wide figure for that item. Pick a calendar year for a year-to-date
        or full-year total, or switch to a rolling window. Tap any number to see those units in
        Inventory, or a column header to sort.
      </HelpBanner>

      {/* Period controls — only one is active at a time */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-gray-300 p-1">
          {[3, 6, 12].map((n) => (
            <button
              key={n}
              onClick={() => { setMode('months'); setMonths(n); }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                mode === 'months' && months === n
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {n} mo
            </button>
          ))}
          <button
            onClick={() => setMode('year')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              mode === 'year' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Year
          </button>
        </div>

        {mode === 'year' && (
          <label className="flex items-center gap-2">
            <span className="sr-only">Year</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-gray-300 px-4 py-2.5 text-base focus:border-primary-500 focus:outline-none"
            >
              {yearOptions().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search item number or description..."
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <PackageSearch size={36} className="mx-auto text-gray-300" />
          <p className="mt-2 text-lg text-gray-500">
            {rows.length === 0
              ? `No usage recorded for ${periodLabel}`
              : 'No items match your search'}
          </p>
        </div>
      ) : (
        <>
          {topTen.length > 1 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Top {topTen.length} items — {periodLabel}
              </h3>
              <MiniBars data={topTen} />
            </div>
          )}

          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {sorted.map((r) => (
              <div key={r.gtinShort} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold text-gray-900">
                      {r.itemNumber}
                    </p>
                    <p className="truncate text-xs text-gray-500">{r.productLabel}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-100 px-3 py-1 text-sm font-bold text-primary-700">
                    {r.total}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {columns
                    .filter((c) => (r.counts[c.id] ?? 0) > 0)
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => drill(r, c.id)}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1.5 text-left text-xs"
                      >
                        <span className="truncate text-gray-600">{c.name}</span>
                        <span className="ml-2 shrink-0 font-semibold text-primary-700">
                          {r.counts[c.id]}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop matrix */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <SortableTh
                    label="Item Number"
                    sortKey="itemNumber"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    className="sticky left-0 bg-white px-3 py-3"
                  />
                  <SortableTh
                    label="Description"
                    sortKey="productLabel"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    className="px-3 py-3"
                  />
                  {columns.map((c) => (
                    <SortableTh
                      key={c.id}
                      label={c.name}
                      sortKey={c.id}
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                      className="px-3 py-3"
                    />
                  ))}
                  <SortableTh
                    label="Total"
                    sortKey="total"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    className="bg-primary-50 px-3 py-3"
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.gtinShort} className="border-b hover:bg-gray-50">
                    <td className="sticky left-0 bg-white px-3 py-2 font-mono font-semibold">
                      {r.itemNumber}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.productLabel}</td>
                    {columns.map((c) => {
                      const n = r.counts[c.id] ?? 0;
                      return (
                        <td key={c.id} className="px-3 py-2">
                          {n === 0 ? (
                            <span className="text-gray-300">0</span>
                          ) : (
                            <button
                              onClick={() => drill(r, c.id)}
                              className="font-semibold text-primary-700 hover:underline"
                            >
                              {n}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="bg-primary-50/40 px-3 py-2 font-bold">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              {/* Totals are computed from the VISIBLE rows, matching Stock by
                  Item — so when a search narrows the table the footer agrees
                  with what is on screen rather than the whole period. */}
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="sticky left-0 bg-gray-50 px-3 py-3">Totals</td>
                  <td className="px-3 py-3 text-gray-500">{sorted.length} item numbers</td>
                  {columns.map((c) => (
                    <td key={c.id} className="px-3 py-3">
                      {sorted.reduce((s, r) => s + (r.counts[c.id] ?? 0), 0)}
                    </td>
                  ))}
                  <td className="bg-primary-50 px-3 py-3">
                    {sorted.reduce((s, r) => s + r.total, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
