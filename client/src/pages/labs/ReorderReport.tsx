import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, ClipboardList } from 'lucide-react';
import { getReorderReport, getReorderExportUrl } from '../../api/parlevels';
import { matchesItemSearch } from '../../utils/itemSearch';
import { HelpBanner } from '../../components/HelpBanner';
import { SearchBar } from '../../components/SearchBar';

export default function ReorderReport() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [distFilter, setDistFilter] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['reorder'], queryFn: getReorderReport });
  const rows = data?.rows ?? [];

  const distributors = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.distributorId, r.distributorName);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const visible = rows.filter(
    (r) =>
      (!distFilter || r.distributorId === distFilter) &&
      matchesItemSearch({ itemNumber: r.itemNumber, productLabel: r.productLabel, gtinShort: r.gtinShort }, search),
  );

  return (
    <div className="mx-auto max-w-2xl lg:max-w-5xl">
      <button onClick={() => navigate('/labs/par-levels')} className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700">
        <ArrowLeft size={20} /> Back to Par Levels
      </button>

      <div className="mb-2 flex items-center gap-2">
        <ClipboardList size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">Reorder Report</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">Beta</span>
      </div>

      <HelpBanner storageKey="reorder">
        Every item that's below its par level, by distributor. <strong>Suggested Order</strong> is
        how many units would bring it back up to par. <strong>Usage / mo</strong> is the recent
        average consumption ({data?.windowMonths ?? 3}-month) for context. Set pars on the{' '}
        <strong>Par Levels</strong> page.
      </HelpBanner>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBar className="min-w-[12rem] flex-1" value={search} onChange={setSearch} placeholder="Search item number or product..." />
        <select
          value={distFilter}
          onChange={(e) => setDistFilter(e.target.value)}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All distributors</option>
          {distributors.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <a
          href={getReorderExportUrl()}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={16} /> Excel
        </a>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base text-gray-500">Nothing below par</p>
          <p className="mt-1 text-sm text-gray-400">
            {rows.length === 0
              ? 'Set minimum stock levels on the Par Levels page to start tracking reorders.'
              : 'Everything with a par level is currently stocked at or above it.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-semibold">Distributor</th>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-3 py-3 text-right font-semibold">On hand</th>
                <th className="px-3 py-3 text-right font-semibold">Par</th>
                <th className="px-3 py-3 text-right font-semibold">Order</th>
                <th className="px-3 py-3 text-right font-semibold">Usage/mo</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={`${r.itemNumber}|${r.distributorId}`} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 text-gray-600">{r.distributorName}</td>
                  <td className="px-4 py-3">
                    <span className="block font-mono text-xs font-semibold text-gray-900">{r.itemNumber}</span>
                    <span className="block truncate text-xs text-gray-500">{r.productLabel}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{r.current}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{r.par}</td>
                  <td className="px-3 py-3 text-right font-bold text-primary-700">{r.shortage}</td>
                  <td className="px-3 py-3 text-right text-gray-400">{r.usagePerMonth || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
