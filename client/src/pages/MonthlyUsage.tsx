import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ArrowLeft, Download, CalendarDays } from 'lucide-react';
import { getMonthlyUsage, getMonthlyUsageExportUrl } from '../api/reports';
import { listDistributors } from '../api/distributors';
import { HelpBanner } from '../components/HelpBanner';

const currentMonth = () => new Date().toISOString().slice(0, 7); // UTC YYYY-MM

export default function MonthlyUsage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [distributorId, setDistributorId] = useState('');

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-usage', month, distributorId],
    queryFn: () => getMonthlyUsage({ month, distributorId: distributorId || undefined }),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });

  const groups = data?.groups ?? [];

  return (
    <div className="mx-auto max-w-4xl lg:max-w-6xl">
      <button
        onClick={() => navigate('/reports')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to Reports
      </button>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Monthly Usage Report</h2>
        <a
          href={getMonthlyUsageExportUrl({ month, distributorId: distributorId || undefined })}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={18} className="text-primary-600" /> Excel
        </a>
      </div>

      <HelpBanner storageKey="monthly-usage">
        Pick any month to see a full itemized usage report — every product consumed, grouped by
        distributor, with quantities. Filter to one distributor or export to Excel.
      </HelpBanner>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-xl border border-gray-300 px-4 py-2.5 text-base focus:border-primary-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Distributor</span>
          <select
            value={distributorId}
            onChange={(e) => setDistributorId(e.target.value)}
            className="mt-1 block rounded-xl border border-gray-300 px-4 py-2.5 text-base bg-white focus:border-primary-500 focus:outline-none"
          >
            <option value="">All distributors</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : !data || data.grandTotal === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <CalendarDays size={36} className="mx-auto text-gray-300" />
          <p className="mt-2 text-lg text-gray-500">No usage recorded for this month</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm font-medium text-gray-700">
            {data.grandTotal} unit{data.grandTotal !== 1 ? 's' : ''} used across {groups.length}{' '}
            distributor{groups.length !== 1 ? 's' : ''}
          </p>

          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.distributorId ?? 'unassigned'} className="rounded-2xl bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                  <h3 className="font-semibold text-gray-900">{g.distributorName}</h3>
                  <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-sm font-semibold text-primary-700">
                    {g.subtotal} unit{g.subtotal !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Mobile cards */}
                <div className="divide-y lg:hidden">
                  {g.items.map((it) => (
                    <div key={it.gtinShort} className="flex items-start justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{it.productLabel}</p>
                        <p className="text-xs font-mono text-gray-500">{it.itemNumber || it.gtinShort}</p>
                        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {it.category}
                        </span>
                      </div>
                      <span className="ml-3 shrink-0 text-base font-bold text-gray-900">{it.qty}</span>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-gray-500">Item Number</th>
                        <th className="px-4 py-2 text-gray-500">Product</th>
                        <th className="px-4 py-2 text-gray-500">Category</th>
                        <th className="px-4 py-2 text-right text-gray-500">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((it) => (
                        <tr key={it.gtinShort} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono">{it.itemNumber || it.gtinShort}</td>
                          <td className="px-4 py-2 font-medium">{it.productLabel}</td>
                          <td className="px-4 py-2 text-gray-600">{it.category}</td>
                          <td className="px-4 py-2 text-right font-semibold">{it.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
