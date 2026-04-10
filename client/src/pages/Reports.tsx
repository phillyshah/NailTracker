import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Package, Users, Clock, XCircle, Inbox, Download, Search, ArrowRightLeft } from 'lucide-react';
import { getSummary, getExpiring, getExportUrl } from '../api/reports';
import { listDistributors } from '../api/distributors';
import { listTransfers, type TransferRecord } from '../api/transfers';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { cn } from '../utils/cn';
import { HelpBanner } from '../components/HelpBanner';

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

  const metrics = [
    { label: 'Total Units', value: summary?.totalUnits ?? '\u2014', icon: Package, color: 'bg-blue-50 text-blue-700' },
    { label: 'Active Distributors', value: summary?.activeDistributors ?? '\u2014', icon: Users, color: 'bg-green-50 text-green-700' },
    { label: 'Expiring < 180d', value: summary?.expiring180 ?? '\u2014', icon: Clock, color: 'bg-amber-50 text-amber-700' },
    { label: 'Expired', value: summary?.expired ?? '\u2014', icon: XCircle, color: 'bg-red-50 text-red-700' },
    { label: 'Unassigned', value: summary?.unassigned ?? '\u2014', icon: Inbox, color: 'bg-gray-100 text-gray-700' },
  ];

  return (
    <div className="mx-auto max-w-4xl lg:max-w-7xl space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Reports</h2>

      <HelpBanner storageKey="reports">
        View inventory metrics, export CSV reports by distributor, and search transfer history by ID. Tap a transfer ID to see full details.
      </HelpBanner>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className={cn('rounded-2xl p-4', m.color)}>
            <m.icon size={24} className="mb-2" />
            <p className="text-2xl font-bold">{m.value}</p>
            <p className="text-sm font-medium opacity-80">{m.label}</p>
          </div>
        ))}
      </div>

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
            <a
              key={d.id}
              href={getExportUrl({ distributorId: d.id })}
              className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                  {d._count?.items ?? 0}
                </span>
              </div>
              <Download size={20} className="text-primary-600 shrink-0" />
            </a>
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
                  <tr className="border-b text-gray-500">
                    <th className="px-3 py-2">Transfer ID</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">To</th>
                    <th className="px-3 py-2">Items</th>
                    <th className="px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t: TransferRecord) => (
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
            {expiring.slice(0, 20).map((item) => (
              <div key={item.udi} className="rounded-xl border border-gray-200 p-3">
                <p className="text-base font-semibold text-gray-900">
                  {item.productLabel || 'Unknown'}
                </p>
                <p className="text-sm text-gray-500 font-mono">{item.udi}</p>
                <div className="mt-2 flex items-center justify-between">
                  <ExpiryBadge expDate={item.expDate} />
                  <span className="text-sm text-gray-500">{item.distributorName}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">UDI</th>
                  <th className="px-3 py-2">Lot</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2">Distributor</th>
                  <th className="px-3 py-2">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {expiring.slice(0, 20).map((item) => (
                  <tr key={item.udi} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{item.productLabel || 'Unknown'}</td>
                    <td className="px-3 py-2 font-mono">{item.udi}</td>
                    <td className="px-3 py-2">{item.lot}</td>
                    <td className="px-3 py-2"><ExpiryBadge expDate={item.expDate} /></td>
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
