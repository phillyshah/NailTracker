import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Package, Users, Clock, XCircle, Inbox, Download } from 'lucide-react';
import { getSummary, getExpiring, getDistributorCounts, getExportUrl } from '../api/reports';
import { listDistributors } from '../api/distributors';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { cn } from '../utils/cn';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

export default function Reports() {
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: getSummary });
  const { data: expiring } = useQuery({ queryKey: ['expiring'], queryFn: () => getExpiring(180) });
  const { data: distCounts } = useQuery({ queryKey: ['dist-counts'], queryFn: getDistributorCounts });
  const { data: distributors = [] } = useQuery({ queryKey: ['distributors'], queryFn: listDistributors });

  const metrics = [
    { label: 'Total Units', value: summary?.totalUnits ?? '\u2014', icon: Package, color: 'bg-blue-50 text-blue-700' },
    { label: 'Active Distributors', value: summary?.activeDistributors ?? '\u2014', icon: Users, color: 'bg-green-50 text-green-700' },
    { label: 'Expiring < 180d', value: summary?.expiring180 ?? '\u2014', icon: Clock, color: 'bg-amber-50 text-amber-700' },
    { label: 'Expired', value: summary?.expired ?? '\u2014', icon: XCircle, color: 'bg-red-50 text-red-700' },
    { label: 'Unassigned', value: summary?.unassigned ?? '\u2014', icon: Inbox, color: 'bg-gray-100 text-gray-700' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Reports</h2>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        <div className="space-y-2">
          {/* Export all */}
          <a
            href={getExportUrl()}
            className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span>All Inventory</span>
            <Download size={20} className="text-primary-600" />
          </a>
          {/* Export by each distributor */}
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

      {/* Chart: Units by Distributor */}
      {distCounts && distCounts.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-gray-900">Units by Distributor</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distCounts} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="distributorName"
                  width={150}
                  tick={{ fontSize: 13 }}
                />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {distCounts.map((_: unknown, idx: number) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
