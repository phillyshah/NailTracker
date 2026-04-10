import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRightLeft, Printer } from 'lucide-react';
import { getTransfer, type TransferRecord } from '../api/transfers';
import { APP_VERSION } from '../version';

export default function TransferDetail() {
  const { transferId } = useParams<{ transferId: string }>();
  const navigate = useNavigate();

  const { data: transfer, isLoading } = useQuery({
    queryKey: ['transfer', transferId],
    queryFn: () => getTransfer(transferId!),
    enabled: !!transferId,
  });

  function handlePrint() {
    const original = document.title;
    document.title = `Transfer-${transferId}`;
    window.print();
    setTimeout(() => { document.title = original; }, 1000);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="mx-auto max-w-2xl text-center py-12">
        <p className="text-lg text-gray-500">Transfer not found</p>
        <button
          onClick={() => navigate('/reports')}
          className="mt-4 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white hover:bg-primary-700"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  const items = transfer.items as any[];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Screen view — hidden when printing */}
      <div className="print:hidden">
        <button
          onClick={() => navigate('/reports')}
          className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={20} /> Back to Reports
        </button>

        <div className="rounded-2xl bg-white p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-mono">{transfer.transferId}</h2>
              <p className="text-sm text-gray-500">{new Date(transfer.createdAt).toLocaleString()}</p>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Printer size={18} />
              Print
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">From</p>
              <p className="text-base font-semibold text-gray-900">{transfer.fromDistributorName}</p>
            </div>
            <div className="rounded-xl bg-primary-50 p-3">
              <p className="text-xs text-primary-500 mb-1">To</p>
              <p className="text-base font-semibold text-primary-900">{transfer.toDistributorName}</p>
            </div>
          </div>

          {transfer.note && (
            <p className="text-sm text-gray-600 mb-4">Note: {transfer.note}</p>
          )}

          <p className="text-sm font-medium text-gray-700 mb-3">
            {transfer.itemCount} item{transfer.itemCount !== 1 ? 's' : ''} transferred
          </p>

          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {items.map((item: any, idx: number) => (
              <div key={idx} className="rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{item.productLabel || 'Unknown'}</p>
                <p className="text-xs font-mono text-gray-500">{item.udi}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>LOT: {item.lot}</span>
                  <span>Exp: {item.expDate ? new Date(item.expDate).toLocaleDateString() : '\u2014'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">UDI</th>
                  <th className="px-3 py-2">LOT</th>
                  <th className="px-3 py-2">GTIN</th>
                  <th className="px-3 py-2">Expiry</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{item.productLabel || 'Unknown'}</td>
                    <td className="px-3 py-2 font-mono text-sm">{item.udi}</td>
                    <td className="px-3 py-2">{item.lot}</td>
                    <td className="px-3 py-2 font-mono text-sm">{item.gtin}</td>
                    <td className="px-3 py-2">{item.expDate ? new Date(item.expDate).toLocaleDateString() : '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transfer.transferredBy && (
            <p className="mt-3 text-xs text-gray-400">Transferred by: {transfer.transferredBy}</p>
          )}
        </div>
      </div>

      {/* PRINT-ONLY: Compact Transfer Report */}
      <div className="hidden print:block">
        <div className="max-w-[700px] mx-auto">
          <div className="mb-3 flex items-center justify-between border-b border-gray-800 pb-2">
            <div>
              <p className="text-base font-bold">Nail Tracker</p>
              <p className="text-xs text-gray-600">Inventory Transfer Report</p>
            </div>
            <div className="text-right text-xs text-gray-600">
              <p className="font-semibold">{transfer.transferId}</p>
              <p>{new Date(transfer.createdAt).toLocaleDateString()} {new Date(transfer.createdAt).toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded border border-gray-400 px-2 py-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase">From: </span>
              <span className="font-bold">{transfer.fromDistributorName}</span>
            </div>
            <div className="rounded border border-gray-400 px-2 py-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase">To: </span>
              <span className="font-bold">{transfer.toDistributorName}</span>
            </div>
          </div>

          {transfer.note && (
            <p className="mb-2 text-xs"><strong>Note:</strong> {transfer.note}</p>
          )}

          <table className="w-full text-left text-xs border-collapse mb-3">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="py-1 pr-1">#</th>
                <th className="py-1 px-1">Product</th>
                <th className="py-1 px-1">UDI</th>
                <th className="py-1 px-1">LOT</th>
                <th className="py-1 px-1">GTIN</th>
                <th className="py-1 pl-1">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-300">
                  <td className="py-1 pr-1 text-gray-500">{idx + 1}</td>
                  <td className="py-1 px-1">{item.productLabel || 'Unknown'}</td>
                  <td className="py-1 px-1 font-mono">{item.udi}</td>
                  <td className="py-1 px-1">{item.lot}</td>
                  <td className="py-1 px-1 font-mono">{item.gtin}</td>
                  <td className="py-1 pl-1">{item.expDate ? new Date(item.expDate).toLocaleDateString() : '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-gray-600">
            Total: <strong>{transfer.itemCount}</strong> items
          </p>

          <p className="fixed bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
            Nail Tracker v{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
