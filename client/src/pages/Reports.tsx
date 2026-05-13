import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Package, Users, Clock, XCircle, Inbox, Download, Search, ArrowRightLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { getSummary, getExpiring, getExportUrl } from '../api/reports';
import { listDistributors } from '../api/distributors';
import { listTransfers, type TransferRecord } from '../api/transfers';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { SortableTh } from '../components/SortableTh';
import { useSortable } from '../hooks/useSortable';
import { cn } from '../utils/cn';
import { HelpBanner } from '../components/HelpBanner';
import type { ExpiringItem } from '../types';

export default function Reports() {
  const navigate = useNavigate();
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: getSummary });
  const { data: expiring } = useQuery({ queryKey: ['expiring'], queryFn: () => getExpiring(180) });
  const { data: distributors = [] } = useQuery({ queryKey: ['distributors'], queryFn: listDistributors });

  const [transferSearch, setTransferSearch] = useState('');
  const [transferPage, setTransferPage] = useState(1);

  const { data: transferData } = useQuery({
    queryKey: ['transfers', transferSearch, transferPage],
    queryFn: () => listTransfers({ page: transferPage, limit: 10, search: transferSearch || undefined }),
  });

  const transfers = transferData?.data ?? [];
  const transferMeta = transferData?.meta;

  const {
    sorted: sortedTransfers,
    sortKey: transferSortKey,
    sortDir: transferSortDir,
    toggleSort: toggleTransferSort,
  } = useSortable(
    transfers,
    {
      transferId: (t: TransferRecord) => t.transferId,
      createdAt: (t: TransferRecord) => t.createdAt,
      fromDistributorName: (t: TransferRecord) => t.fromDistributorName || '',
      toDistributorName: (t: TransferRecord) => t.toDistributorName || '',
      itemCount: (t: TransferRecord) => t.itemCount,
    },
    'createdAt',
    'desc',
  );

  const expiringList: ExpiringItem[] = (expiring ?? []).slice(0, 20);
  const {
    sorted: sortedExpiring,
    sortKey: expSortKey,
    sortDir: expSortDir,
    toggleSort: toggleExpSort,
  } = useSortable(
    expiringList,
    {
      productLabel: (i) => i.productLabel || '',
      itemNumber: (i) => i.itemNumber || '',
      lot: (i) => i.lot,
      expDate: (i) => i.expDate,
      distributorName: (i) => i.distributorName || '',
      daysUntilExpiry: (i) => i.daysUntilExpiry,
    },
    'daysUntilExpiry',
    'asc',
  );

  const metrics: Array<{
    label: string;
    value: number | string;
    icon: typeof Package;
    color: string;
    href: string;
  }> = [
    { label: 'Total Units', value: summary?.totalUnits ?? '\u2014', icon: Package, color: 'bg-blue-50 text-blue-700', href: '/inventory' },
    { label: 'Active Distributors', value: summary?.activeDistributors ?? '\u2014', icon: Users, color: 'bg-green-50 text-green-700', href: '/distributors' },
    { label: 'Expiring < 180d', value: summary?.expiring180 ?? '\u2014', icon: Clock, color: 'bg-amber-50 text-amber-700', href: '/inventory?expiringInDays=180' },
    { label: 'Expired', value: summary?.expired ?? '\u2014', icon: XCircle, color: 'bg-red-50 text-red-700', href: '/inventory?expired=true' },
    { label: 'Unassigned', value: summary?.unassigned ?? '\u2014', icon: Inbox, color: 'bg-gray-100 text-gray-700', href: '/inventory?unassigned=true' },
  ];

  return (
    <div className="mx-auto max-w-4xl lg:max-w-7xl space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Reports</h2>

      <HelpBanner storageKey="reports">
        View inventory metrics (tap any card to drill in), download Excel reports by distributor, and search transfer history. Tap a column header to sort or a transfer ID to see full details.
      </HelpBanner>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <button
            key={m.label}
            onClick={() => navigate(m.href)}
            className={cn(
              'rounded-2xl p-4 text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-400',
              m.color,
            )}
          >
            <m.icon size={24} className="mb-2" />
            <p className="text-2xl font-bold">{m.value}</p>
            <p className="text-sm font-medium opacity-80">{m.label}</p>
          </button>
        ))}
      </div>

      {/* Stock by Item Number drilldown */}
      <button
        onClick={() => navigate('/reports/stock-by-item')}
        className="w-full rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-shadow text-left focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-primary-50 p-3 text-primary-700">
            <LayoutGrid size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">Stock by Item Number</h3>
            <p className="text-sm text-gray-600">
              Count of each item across Home Office and every distributor — sortable, drillable, exportable.
            </p>
          </div>
          <ChevronRight size={24} className="text-gray-400 shrink-0" />
        </div>
      </button>

      {/* Export by distributor */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-900">Export Inventory</h3>
        <div className="grid gap-2 lg:grid-cols-2">
          <a
            href={getExportUrl()}
            className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span>All Inventory</span>
            <Download size={20} className="text-primary-600" />
          </a>
          {distributors.map((d) => (
            <button
              key={d.id}
              onClick={() => navigate(`/distributors/${d.id}`)}
              className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                  {d._count?.items ?? 0}
                </span>
              </div>
              <ChevronRight size={20} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Transfer History */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-gray-900">Transfer History</h3>
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={transferSearch}
              onChange={(e) => { setTransferSearch(e.target.value); setTransferPage(1); }}
              placeholder="Search by transfer ID or distributor..."
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
            />
          </div>
        </div>

        {transfers.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No transfers found</p>
        ) : (
          <>
            <div className="space-y-2 lg:hidden">
              {transfers.map((t: TransferRecord) => (
                <div key={t.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <button onClick={() => navigate(`/transfer/${t.transferId}`)} className="text-sm font-bold font-mono text-primary-700 underline">{t.transferId}</button>
                    <span className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <span>{t.fromDistributorName}</span>
                    <ArrowRightLeft size={14} className="text-gray-400" />
                    <span>{t.toDistributorName}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t.itemCount} item{t.itemCount !== 1 ? 's' : ''}{t.note ? ` — ${t.note}` : ''}</p>
                </div>
              ))}
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <SortableTh label="Transfer ID" sortKey="transferId" currentKey={transferSortKey} currentDir={transferSortDir} onSort={toggleTransferSort} className="px-3 py-2" />
                    <SortableTh label="Date" sortKey="createdAt" currentKey={transferSortKey} currentDir={transferSortDir} onSort={toggleTransferSort} className="px-3 py-2" />
                    <SortableTh label="From" sortKey="fromDistributorName" currentKey={transferSortKey} currentDir={transferSortDir} onSort={toggleTransferSort} className="px-3 py-2" />
                    <SortableTh label="To" sortKey="toDistributorName" currentKey={transferSortKey} currentDir={transferSortDir} onSort={toggleTransferSort} className="px-3 py-2" />
                    <SortableTh label="Items" sortKey="itemCount" currentKey={transferSortKey} currentDir={transferSortDir} onSort={toggleTransferSort} className="px-3 py-2" />
                    <th className="px-3 py-2 text-gray-500">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransfers.map((t: TransferRecord) => (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-semibold text-primary-700"><button onClick={() => navigate(`/transfer/${t.transferId}`)} className="underline hover:text-primary-900">{t.transferId}</button></td>
                      <td className="px-3 py-2">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{t.fromDistributorName}</td>
                      <td className="px-3 py-2">{t.toDistributorName}</td>
                      <td className="px-3 py-2 font-semibold">{t.itemCount}</td>
                      <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]">{t.note || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {transferMeta && transferMeta.total! > 10 && (
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  onClick={() => setTransferPage((p) => Math.max(1, p - 1))}
                  disabled={transferPage <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-600">
                  Page {transferMeta.page} of {Math.ceil(transferMeta.total! / transferMeta.limit!)}
                </span>
                <button
                  onClick={() => setTransferPage((p) => p + 1)}
                  disabled={transferPage >= Math.ceil(transferMeta.total! / transferMeta.limit!)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Expiring items table */}
      {expiring && expiring.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-gray-900">
            Expiring Items (next 180 days)
          </h3>
          <div className="space-y-2 lg:hidden">
            {sortedExpiring.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 p-3">
                <p className="text-base font-semibold text-gray-900">
                  {item.productLabel || 'Unknown'}
                </p>
                <p className="text-sm text-gray-500 font-mono">{item.itemNumber || '—'}</p>
                <div className="mt-2 flex items-center justify-between">
                  <ExpiryBadge expDate={item.expDate} showDate />
                  <span className="text-sm text-gray-500">{item.distributorName}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <SortableTh label="Product" sortKey="productLabel" currentKey={expSortKey} currentDir={expSortDir} onSort={toggleExpSort} className="px-3 py-2" />
                  <SortableTh label="Item Number" sortKey="itemNumber" currentKey={expSortKey} currentDir={expSortDir} onSort={toggleExpSort} className="px-3 py-2" />
                  <SortableTh label="Lot" sortKey="lot" currentKey={expSortKey} currentDir={expSortDir} onSort={toggleExpSort} className="px-3 py-2" />
                  <SortableTh label="Expiry" sortKey="expDate" currentKey={expSortKey} currentDir={expSortDir} onSort={toggleExpSort} className="px-3 py-2" />
                  <SortableTh label="Distributor" sortKey="distributorName" currentKey={expSortKey} currentDir={expSortDir} onSort={toggleExpSort} className="px-3 py-2" />
                  <SortableTh label="Days Left" sortKey="daysUntilExpiry" currentKey={expSortKey} currentDir={expSortDir} onSort={toggleExpSort} className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {sortedExpiring.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{item.productLabel || 'Unknown'}</td>
                    <td className="px-3 py-2 font-mono">{item.itemNumber || '—'}</td>
                    <td className="px-3 py-2">{item.lot}</td>
                    <td className="px-3 py-2"><ExpiryBadge expDate={item.expDate} showDate /></td>
                    <td className="px-3 py-2">{item.distributorName}</td>
                    <td className="px-3 py-2 font-semibold">{item.daysUntilExpiry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
