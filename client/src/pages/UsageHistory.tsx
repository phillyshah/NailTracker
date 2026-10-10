import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ChevronRight, Search, ClipboardList } from 'lucide-react';
import { listUsage } from '../api/usage';
import { HelpBanner } from '../components/HelpBanner';

export default function UsageHistory() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['usage', { page, search }],
    queryFn: () => listUsage({ page, limit: 25, search: search || undefined }),
  });

  const tickets = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <h2 className="mb-4 text-xl font-bold text-gray-900">Usage History</h2>

      <HelpBanner storageKey="usage-history">
        Every usage ticket you record appears here — tap one to see the items consumed and print it.
      </HelpBanner>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by ticket ID or distributor"
          className="block w-full rounded-xl border border-gray-300 pl-10 pr-4 py-3 text-base focus:border-primary-500 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <ClipboardList size={36} className="mx-auto text-gray-300" />
          <p className="mt-2 text-lg text-gray-500">No usage tickets yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/usage/history/${encodeURIComponent(t.ticketId)}`)}
              className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm text-left hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="font-mono text-base font-semibold text-gray-900">{t.ticketId}</p>
                <p className="text-sm text-gray-500">
                  {t.distributorName} · {t.itemCount} item{t.itemCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString()}</p>
              </div>
              <ChevronRight size={20} className="shrink-0 text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
