import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Download, Search, ChevronLeft } from 'lucide-react';
import { getStockByItem, getStockByItemExportUrl, type StockByItemRow } from '../api/reports';
import { listDistributors } from '../api/distributors';
import { SortableTh } from '../components/SortableTh';
import { useSortable } from '../hooks/useSortable';
import { HelpBanner } from '../components/HelpBanner';
import { cn } from '../utils/cn';

const HOME = 'home';

export default function StockByItem() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  // '' = every location (the original view). 'home' or a distributor id narrows
  // the report to that one column, and the Excel export follows the same filter.
  const [locationId, setLocationId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-by-item', locationId],
    queryFn: () => getStockByItem({ locationId: locationId || undefined }),
  });

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  // Memoized: a bare `?? []` mints a new array identity every render, which
  // defeats the memos below and useSortable's (see CLAUDE.md).
  const locations = useMemo(() => data?.locations ?? [], [data]);
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.itemNumber.toLowerCase().includes(q) ||
        r.productLabel.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Build dynamic sort getters: itemNumber, productLabel, total, and one per location.
  const getters = useMemo(() => {
    const g: Record<string, (r: StockByItemRow) => string | number> = {
      itemNumber: (r) => r.itemNumber || r.gtinShort,
      productLabel: (r) => r.productLabel,
      total: (r) => r.total,
    };
    for (const loc of locations) {
      g[loc.id] = (r) => r.counts[loc.id] ?? 0;
    }
    return g;
  }, [locations]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortable(
    filtered,
    getters,
    'itemNumber',
    'asc',
  );

  function drillToAll(gtinShort: string) {
    const params = new URLSearchParams();
    params.set('gtinShort', gtinShort);
    navigate(`/inventory?${params.toString()}`);
  }

  // `colId` is a column's location id — named distinctly from the `locationId`
  // filter state above, which it would otherwise shadow.
  function drillTo(colId: string, gtinShort: string) {
    const params = new URLSearchParams();
    params.set('gtinShort', gtinShort);
    if (colId === HOME) params.set('unassigned', 'true');
    else params.set('distributorId', colId);
    navigate(`/inventory?${params.toString()}`);
  }

  const grandTotal = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);

  // With one location selected the Total column just repeats it, so hide it.
  const showTotal = locations.length > 1;

  return (
    <div className="mx-auto max-w-4xl lg:max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/reports')}
            className="rounded-xl border border-gray-300 p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Back to Reports"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-gray-900">Stock by Item Number</h2>
        </div>
        <a
          href={getStockByItemExportUrl({ locationId: locationId || undefined })}
          className="flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          <Download size={18} />
          <span className="hidden sm:inline">Export Excel</span>
        </a>
      </div>

      <HelpBanner storageKey="stock-by-item">
        Counts of each item number across Home Office and every distributor. Use <strong>Location</strong> to narrow to a single place \u2014 the Excel export follows whatever you pick. Tap any column header to sort, tap any count to drill into the matching inventory.
      </HelpBanner>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Location</span>
        <select
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base focus:border-primary-500 focus:outline-none sm:w-auto"
        >
          <option value="">All locations</option>
          <option value={HOME}>Home Office</option>
          {distributors.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>

      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search item number or description..."
          className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg text-gray-500">No inventory found</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {sorted.map((r) => (
              <div key={r.gtinShort} className="rounded-2xl bg-white p-4 shadow-sm">
                <button
                  onClick={() => drillToAll(r.gtinShort)}
                  className="flex w-full items-baseline justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-primary-700 truncate hover:underline">
                      {r.itemNumber || r.gtinShort}
                    </p>
                    <p className="text-sm text-gray-600 truncate">{r.productLabel}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-100 px-3 py-1 text-sm font-bold text-primary-700">
                    {r.total}
                  </span>
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {locations
                    .filter((loc) => (r.counts[loc.id] ?? 0) > 0)
                    .map((loc) => (
                      <button
                        key={loc.id}
                        onClick={() => drillTo(loc.id, r.gtinShort)}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
                      >
                        <span className="text-xs font-medium text-gray-600 truncate">
                          {loc.name}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {r.counts[loc.id] ?? 0}
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
                <tr className="border-b text-gray-500">
                  <SortableTh
                    label="Item Number"
                    sortKey="itemNumber"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    className="sticky left-0 bg-white px-4 py-3"
                  />
                  <SortableTh
                    label="Description"
                    sortKey="productLabel"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    className="px-4 py-3"
                  />
                  {locations.map((loc) => (
                    <SortableTh
                      key={loc.id}
                      label={loc.name}
                      sortKey={loc.id}
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                      className={cn(
                        'px-3 py-3 text-right',
                        loc.id === HOME && 'bg-amber-50',
                      )}
                    />
                  ))}
                  {showTotal && (
                    <SortableTh
                      label="Total"
                      sortKey="total"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                      className="px-4 py-3 text-right bg-primary-50"
                    />
                  )}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.gtinShort} className="border-b hover:bg-gray-50">
                    <td className="sticky left-0 bg-white px-4 py-3 font-mono font-semibold">
                      <button
                        onClick={() => drillToAll(r.gtinShort)}
                        className="text-primary-700 hover:underline"
                      >
                        {r.itemNumber || r.gtinShort}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.productLabel}</td>
                    {locations.map((loc) => {
                      const n = r.counts[loc.id] ?? 0;
                      return (
                        <td
                          key={loc.id}
                          className={cn(
                            'px-3 py-3 text-right',
                            loc.id === HOME && 'bg-amber-50/50',
                            n === 0 && 'text-gray-300',
                          )}
                        >
                          {n > 0 ? (
                            <button
                              onClick={() => drillTo(loc.id, r.gtinShort)}
                              className="font-semibold text-primary-700 hover:underline"
                            >
                              {n}
                            </button>
                          ) : (
                            <span>0</span>
                          )}
                        </td>
                      );
                    })}
                    {showTotal && (
                      <td className="px-4 py-3 text-right font-bold bg-primary-50/40">
                        <button
                          onClick={() => drillToAll(r.gtinShort)}
                          className="hover:underline"
                        >
                          {r.total}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="sticky left-0 bg-gray-50 px-4 py-3">Totals</td>
                  <td className="px-4 py-3 text-gray-500">{sorted.length} item numbers</td>
                  {locations.map((loc) => {
                    const colTotal = sorted.reduce(
                      (s, r) => s + (r.counts[loc.id] ?? 0),
                      0,
                    );
                    return (
                      <td
                        key={loc.id}
                        className={cn(
                          'px-3 py-3 text-right',
                          loc.id === HOME && 'bg-amber-50',
                        )}
                      >
                        {colTotal}
                      </td>
                    );
                  })}
                  {showTotal && (
                    <td className="px-4 py-3 text-right bg-primary-100">{grandTotal}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
