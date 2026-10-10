import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ArrowLeft, Download, LayoutGrid } from 'lucide-react';
import { getUsageMatrix, getUsageMatrixExportUrl } from '../api/reports';
import { HelpBanner } from '../components/HelpBanner';

export default function UsageMatrix() {
  const navigate = useNavigate();
  const [months, setMonths] = useState(3);

  const { data, isLoading } = useQuery({
    queryKey: ['usage-matrix', months],
    queryFn: () => getUsageMatrix({ months }),
  });

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];

  return (
    <div className="mx-auto max-w-4xl lg:max-w-6xl">
      <button
        onClick={() => navigate('/reports')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to Reports
      </button>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Usage by Distributor</h2>
        <a
          href={getUsageMatrixExportUrl({ months })}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={18} className="text-primary-600" /> Excel
        </a>
      </div>

      <HelpBanner storageKey="usage-matrix">
        Units consumed by product category at each distributor over the window. Compare who uses what
        to help balance stock and plan orders.
      </HelpBanner>

      {/* Window control */}
      <div className="mb-4 inline-flex rounded-xl border border-gray-300 p-1">
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            onClick={() => setMonths(n)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              months === n ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {n} mo
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : !data || data.grandTotal === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <LayoutGrid size={36} className="mx-auto text-gray-300" />
          <p className="mt-2 text-lg text-gray-500">No usage recorded in this window yet</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {rows.map((r) => (
              <div key={r.category} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{r.category}</p>
                  <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-sm font-semibold text-primary-700">
                    {r.total}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {columns.map((c) => (
                    <div key={c.id} className="flex justify-between">
                      <span className="text-gray-500 truncate">{c.name}</span>
                      <span className="font-medium text-gray-800">{r.counts[c.id] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop matrix */}
          <div className="hidden lg:block rounded-2xl bg-white p-5 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-gray-500 sticky left-0 bg-white">Product Category</th>
                  {columns.map((c) => (
                    <th key={c.id} className="px-4 py-2 text-right text-gray-500">
                      {c.name}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right text-gray-700 bg-primary-50/40">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.category} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium sticky left-0 bg-white">{r.category}</td>
                    {columns.map((c) => (
                      <td key={c.id} className="px-4 py-2 text-right">
                        {r.counts[c.id] || ''}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold bg-primary-50/40">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="px-4 py-2 sticky left-0 bg-white">Total</td>
                  {columns.map((c) => (
                    <td key={c.id} className="px-4 py-2 text-right">
                      {data.totalsByColumn[c.id] || ''}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right bg-primary-50/40">{data.grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
