import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ArrowLeft, Download, TrendingUp } from 'lucide-react';
import { getUsageTrends, getUsageTrendsExportUrl } from '../api/reports';
import { listDistributors } from '../api/distributors';
import { MiniBars } from '../components/MiniBars';
import { HelpBanner } from '../components/HelpBanner';

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

export default function UsageTrends() {
  const navigate = useNavigate();
  const [months, setMonths] = useState(3);
  const [distributorId, setDistributorId] = useState('');

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['usage-trends', months, distributorId],
    queryFn: () => getUsageTrends({ months, distributorId: distributorId || undefined }),
  });

  const monthsList = data?.months ?? [];
  const bars = monthsList.map((m) => ({ label: monthLabel(m), value: data?.totalsByMonth[m] ?? 0 }));

  return (
    <div className="mx-auto max-w-4xl lg:max-w-6xl">
      <button
        onClick={() => navigate('/reports')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to Reports
      </button>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Usage Trends</h2>
        <a
          href={getUsageTrendsExportUrl({ months, distributorId: distributorId || undefined })}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={18} className="text-primary-600" /> Excel
        </a>
      </div>

      <HelpBanner storageKey="usage-trends">
        Units consumed each month by product category. Use it to spot growth, seasonality, and slow
        movers. Switch the window or filter to one distributor.
      </HelpBanner>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-xl border border-gray-300 p-1">
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
        <label className="block">
          <span className="sr-only">Distributor</span>
          <select
            value={distributorId}
            onChange={(e) => setDistributorId(e.target.value)}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-base bg-white focus:border-primary-500 focus:outline-none"
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
      ) : !data || data.total === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <TrendingUp size={36} className="mx-auto text-gray-300" />
          <p className="mt-2 text-lg text-gray-500">No usage recorded in this window yet</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-5 shadow-sm mb-4">
            <p className="mb-3 text-sm font-medium text-gray-700">
              Total units consumed per month — {data.total} over {months} months
            </p>
            <MiniBars data={bars} />
          </div>

          {/* Category × month table */}
          <div className="rounded-2xl bg-white p-5 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Product Category</th>
                  {monthsList.map((m) => (
                    <th key={m} className="px-3 py-2 text-right text-gray-500">
                      {monthLabel(m)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.series.map((s) => (
                  <tr key={s.category} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium sticky left-0 bg-white">{s.category}</td>
                    {monthsList.map((m) => (
                      <td key={m} className="px-3 py-2 text-right">
                        {s.byMonth[m] || ''}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold">{s.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-semibold">
                  <td className="px-3 py-2 sticky left-0 bg-white">Total</td>
                  {monthsList.map((m) => (
                    <td key={m} className="px-3 py-2 text-right">
                      {data.totalsByMonth[m] || ''}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">{data.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
