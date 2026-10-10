import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, PackageSearch } from 'lucide-react';
import { getUsageByItem, getUsageByItemExportUrl } from '../api/reports';
import { SearchBar } from '../components/SearchBar';
import { HelpBanner } from '../components/HelpBanner';
import { MiniBars } from '../components/MiniBars';
import type { UsageByItemCategory } from '../api/reports';

/** Catalogue order, matching PRODUCT_CATEGORIES on the server. */
const CATEGORIES = [
  'Short Nail',
  'Long Nail',
  'Lag Screw',
  'Interlocking Screw',
  'Cap Screw',
  'Set Screw',
  'Other',
];

/** Years offered in the picker: this year back to 2024, newest first. */
function yearOptions(): number[] {
  const now = new Date().getUTCFullYear();
  const years: number[] = [];
  for (let y = now; y >= 2024; y--) years.push(y);
  return years;
}

export default function UsageByItem() {
  const navigate = useNavigate();

  // The two period controls are mutually exclusive by construction: `mode`
  // decides which one is live, so only one is ever sent and only one rendered.
  const [mode, setMode] = useState<'months' | 'year'>('year');
  const [months, setMonths] = useState(12);
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  const params = {
    ...(mode === 'year' ? { year } : { months }),
    ...(category ? { category } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['usage-by-item', mode, mode === 'year' ? year : months, category],
    queryFn: () => getUsageByItem(params),
  });

  // Memoized rather than a bare `?? []`: a new array identity each render would
  // defeat the memos below (see CLAUDE.md).
  const categories = useMemo(() => data?.categories ?? [], [data]);

  // Search narrows the items inside each group, dropping groups left empty.
  const visible: UsageByItemCategory[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            i.itemNumber.toLowerCase().includes(q) ||
            i.productLabel.toLowerCase().includes(q),
        ),
      }))
      .map((c) => ({ ...c, subtotal: c.items.reduce((s, i) => s + i.qty, 0) }))
      .filter((c) => c.items.length > 0);
  }, [categories, search]);

  const shownTotal = useMemo(
    () => visible.reduce((s, c) => s + c.subtotal, 0),
    [visible],
  );

  // Top movers across every category — the "what do we use most" answer at a glance.
  const topTen = useMemo(
    () =>
      visible
        .flatMap((c) => c.items)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10)
        .map((i) => ({ label: i.itemNumber, value: i.qty })),
    [visible],
  );

  const periodLabel = mode === 'year' ? `${year}` : `last ${months} months`;

  return (
    <div className="mx-auto max-w-4xl lg:max-w-6xl space-y-4">
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
        Total units used for each item number across <strong>all</strong> distributors, grouped by
        product category. Within each category the most-used items are listed first. Pick a
        calendar year for a year-to-date or full-year total, or switch to a rolling window. The
        Excel export follows whatever period and category you have selected.
      </HelpBanner>

      {/* Period — only one control is active at a time */}
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

        <label className="flex items-center gap-2">
          <span className="sr-only">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-base focus:border-primary-500 focus:outline-none"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
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
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <PackageSearch size={36} className="mx-auto text-gray-300" />
          <p className="mt-2 text-lg text-gray-500">
            {categories.length === 0
              ? `No usage recorded for ${periodLabel}`
              : 'No items match your search'}
          </p>
        </div>
      ) : (
        <>
          {topTen.length > 1 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Most used — {periodLabel}
              </h3>
              <MiniBars data={topTen} />
            </div>
          )}

          {visible.map((c) => (
            <div key={c.category} className="rounded-2xl bg-white shadow-sm">
              <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 px-5 py-3">
                <h3 className="text-base font-bold text-gray-900">{c.category}</h3>
                <span className="shrink-0 rounded-full bg-primary-100 px-3 py-1 text-sm font-bold text-primary-700">
                  {c.subtotal}
                </span>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 p-3 lg:hidden">
                {c.items.map((i) => (
                  <button
                    key={i.gtinShort}
                    onClick={() => navigate(`/inventory?gtinShort=${i.gtinShort}`)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-xl border border-gray-200 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-primary-700">
                        {i.itemNumber}
                      </p>
                      <p className="truncate text-xs text-gray-500">{i.productLabel}</p>
                    </div>
                    <span className="shrink-0 text-base font-bold text-gray-900">{i.qty}</span>
                  </button>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden lg:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="px-5 py-2 font-medium">Item Number</th>
                      <th className="px-5 py-2 font-medium">Description</th>
                      <th className="px-5 py-2 text-right font-medium">Qty Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.items.map((i) => (
                      <tr key={i.gtinShort} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-2 font-mono font-semibold">
                          <button
                            onClick={() => navigate(`/inventory?gtinShort=${i.gtinShort}`)}
                            className="text-primary-700 hover:underline"
                          >
                            {i.itemNumber}
                          </button>
                        </td>
                        <td className="px-5 py-2 text-gray-600">{i.productLabel}</td>
                        <td className="px-5 py-2 text-right font-bold">{i.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="flex items-baseline justify-between rounded-2xl bg-gray-50 px-5 py-4">
            <span className="font-bold text-gray-900">
              Total units used — {periodLabel}
              {category && ` · ${category}`}
            </span>
            <span className="text-xl font-bold text-primary-700">{shownTotal}</span>
          </div>
        </>
      )}
    </div>
  );
}
