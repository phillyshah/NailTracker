import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { getUsageTicket } from '../api/usage';
import { SortableTh } from '../components/SortableTh';
import { useSortable } from '../hooks/useSortable';
import { APP_VERSION } from '../version';
import { formatExpiry } from '../utils/expiry';

interface UsageItem {
  id?: string;
  udi: string;
  itemNumber?: string | null;
  productLabel?: string | null;
  lot: string;
  gtin: string;
  expDate: string | null;
}

export default function UsageDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ['usage', ticketId],
    queryFn: () => getUsageTicket(ticketId!),
    enabled: !!ticketId,
  });

  function handlePrint() {
    const original = document.title;
    document.title = `Usage-${ticketId}`;
    window.print();
    setTimeout(() => {
      document.title = original;
    }, 1000);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-2xl text-center py-12">
        <p className="text-lg text-gray-500">
          {error ? `Error: ${error.message}` : 'Usage ticket not found'}
        </p>
        <button
          onClick={() => navigate('/usage/history')}
          className="mt-4 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white hover:bg-primary-700"
        >
          Back to Usage History
        </button>
      </div>
    );
  }

  const items = Array.isArray(ticket.items) ? (ticket.items as UsageItem[]) : [];

  const { sorted: sortedItems, sortKey, sortDir, toggleSort } = useSortable(
    items,
    {
      productLabel: (i) => i.productLabel || '',
      itemNumber: (i) => i.itemNumber || '',
      lot: (i) => i.lot,
      gtin: (i) => i.gtin,
      expDate: (i) => i.expDate,
    },
    'productLabel',
  );

  return (
    <div className="mx-auto max-w-4xl">
      {/* Screen view */}
      <div className="print:hidden">
        <button
          onClick={() => navigate('/usage/history')}
          className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={20} /> Back to Usage History
        </button>

        <div className="rounded-2xl bg-white p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-mono">{ticket.ticketId}</h2>
              <p className="text-sm text-gray-500">{new Date(ticket.createdAt).toLocaleString()}</p>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Printer size={18} />
              Print
            </button>
          </div>

          <div className="rounded-xl bg-gray-50 p-3 mb-4">
            <p className="text-xs text-gray-500 mb-1">Consumed from</p>
            <p className="text-base font-semibold text-gray-900">{ticket.distributorName}</p>
          </div>

          {ticket.note && <p className="text-sm text-gray-600 mb-4">Note: {ticket.note}</p>}

          <p className="text-sm font-medium text-gray-700 mb-3">
            {ticket.itemCount} item{ticket.itemCount !== 1 ? 's' : ''} consumed
          </p>

          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {sortedItems.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{item.productLabel || 'Unknown'}</p>
                <p className="text-xs font-mono text-gray-500">{item.itemNumber || '—'}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>LOT: {item.lot}</span>
                  <span>Exp: {formatExpiry(item.expDate)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-gray-500">#</th>
                  <SortableTh label="Product" sortKey="productLabel" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortableTh label="Item Number" sortKey="itemNumber" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortableTh label="LOT" sortKey="lot" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortableTh label="GTIN" sortKey="gtin" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                  <SortableTh label="Expiry" sortKey="expDate" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{item.productLabel || 'Unknown'}</td>
                    <td className="px-3 py-2 font-mono text-sm">{item.itemNumber || '—'}</td>
                    <td className="px-3 py-2">{item.lot}</td>
                    <td className="px-3 py-2 font-mono text-sm">{item.gtin}</td>
                    <td className="px-3 py-2">{formatExpiry(item.expDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ticket.recordedBy && (
            <p className="mt-3 text-xs text-gray-400">Recorded by: {ticket.recordedBy}</p>
          )}
        </div>
      </div>

      {/* PRINT-ONLY */}
      <div className="hidden print:block">
        <div className="max-w-[700px] mx-auto">
          <div className="mb-3 flex items-center justify-between border-b border-gray-800 pb-2">
            <div>
              <p className="text-base font-bold">Nail Tracker</p>
              <p className="text-xs text-gray-600">Inventory Usage Report</p>
            </div>
            <div className="text-right text-xs text-gray-600">
              <p className="font-semibold">{ticket.ticketId}</p>
              <p>
                {new Date(ticket.createdAt).toLocaleDateString()}{' '}
                {new Date(ticket.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="mb-3 rounded border border-gray-400 px-2 py-1.5 text-sm">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Consumed from: </span>
            <span className="font-bold">{ticket.distributorName}</span>
          </div>

          {ticket.note && (
            <p className="mb-2 text-xs">
              <strong>Note:</strong> {ticket.note}
            </p>
          )}

          <table className="w-full text-left text-xs border-collapse mb-3">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="py-1 pr-1">#</th>
                <th className="py-1 px-1">Product</th>
                <th className="py-1 px-1">Item Number</th>
                <th className="py-1 px-1">LOT</th>
                <th className="py-1 px-1">GTIN</th>
                <th className="py-1 pl-1">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-300">
                  <td className="py-1 pr-1 text-gray-500">{idx + 1}</td>
                  <td className="py-1 px-1">{item.productLabel || 'Unknown'}</td>
                  <td className="py-1 px-1 font-mono">{item.itemNumber || '—'}</td>
                  <td className="py-1 px-1">{item.lot}</td>
                  <td className="py-1 px-1 font-mono">{item.gtin}</td>
                  <td className="py-1 pl-1">{formatExpiry(item.expDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-gray-600">
            Total: <strong>{ticket.itemCount}</strong> items
          </p>

          <p className="fixed bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
            Nail Tracker v{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
