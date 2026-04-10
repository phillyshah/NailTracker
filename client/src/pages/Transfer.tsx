import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Check,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { listInventory, reassignItem } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { createTransfer, type TransferRecord } from '../api/transfers';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { APP_VERSION } from '../version';
import { cn } from '../utils/cn';
import type { InventoryItem } from '../types';

export default function Transfer() {
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();

  const [step, setStep] = useState<'select' | 'confirm' | 'done'>('select');
  const [fromDistId, setFromDistId] = useState('');
  const [toDistId, setToDistId] = useState('');
  const [note, setNote] = useState('');
  const [selectedUdis, setSelectedUdis] = useState<Set<string>>(new Set());
  const [savedTransfer, setSavedTransfer] = useState<TransferRecord | null>(null);

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const { data: inventoryData, isLoading: loadingItems } = useQuery({
    queryKey: ['inventory', { distributorId: fromDistId, limit: 200 }],
    queryFn: () => listInventory({ distributorId: fromDistId, limit: 200 }),
    enabled: !!fromDistId,
  });

  const items = inventoryData?.data ?? [];

  const transferMutation = useMutation({
    mutationFn: async () => {
      const selected = items.filter((i) => selectedUdis.has(i.udi));
      const fromDist = distributors.find((d) => d.id === fromDistId);
      const toDist = distributors.find((d) => d.id === toDistId);

      // Reassign each item
      for (const item of selected) {
        await reassignItem(item.udi, toDistId || null, note || 'Transfer');
      }

      // Save transfer record to DB
      const transfer = await createTransfer({
        fromDistributorId: fromDistId || null,
        fromDistributorName: fromDist?.name || 'Unassigned',
        toDistributorId: toDistId || null,
        toDistributorName: toDist?.name || 'Unassigned',
        note: note || '',
        items: selected.map((i) => ({
          udi: i.udi,
          productLabel: i.productLabel,
          lot: i.lot,
          gtin: i.gtin,
          expDate: i.expDate,
        })),
      });

      return transfer;
    },
    onSuccess: (transfer) => {
      setSavedTransfer(transfer);
      setStep('done');
      addToast(`${transfer.itemCount} items transferred — ${transfer.transferId}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  function toggleItem(udi: string) {
    setSelectedUdis((prev) => {
      const next = new Set(prev);
      if (next.has(udi)) next.delete(udi);
      else next.add(udi);
      return next;
    });
  }

  function selectAll() {
    setSelectedUdis(new Set(items.map((i) => i.udi)));
  }

  function selectNone() {
    setSelectedUdis(new Set());
  }

  function resetAll() {
    setStep('select');
    setFromDistId('');
    setToDistId('');
    setNote('');
    setSelectedUdis(new Set());
    setSavedTransfer(null);
  }

  function handlePrint() {
    // Set document title for file naming when saving PDF
    const original = document.title;
    if (savedTransfer) {
      document.title = `Transfer-${savedTransfer.transferId}`;
    }
    window.print();
    // Restore after small delay
    setTimeout(() => { document.title = original; }, 1000);
  }

  const fromDist = distributors.find((d) => d.id === fromDistId);
  const toDist = distributors.find((d) => d.id === toDistId);
  const selectedItems = items.filter((i) => selectedUdis.has(i.udi));

  return (
    <div className="mx-auto max-w-4xl lg:max-w-7xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Regular page content — hidden when printing */}
      <div className="print:hidden">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Transfer Inventory</h2>

        {/* STEP 1: Select source, items, destination */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-700">From Distributor</span>
                  <select
                    value={fromDistId}
                    onChange={(e) => {
                      setFromDistId(e.target.value);
                      setSelectedUdis(new Set());
                    }}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">Select source...</option>
                    {distributors.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-700">To Distributor</span>
                  <select
                    value={toDistId}
                    onChange={(e) => setToDistId(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">Select destination...</option>
                    {distributors
                      .filter((d) => d.id !== fromDistId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Transfer Note (optional)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Replenishment for Q2 cases"
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                />
              </label>
            </div>

            {fromDistId && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-800">
                    Items at {fromDist?.name} ({items.length})
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-sm text-primary-600 hover:underline">Select All</button>
                    <button onClick={selectNone} className="text-sm text-gray-500 hover:underline">Clear</button>
                  </div>
                </div>

                {loadingItems ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                    <p className="text-gray-500">No items at this distributor</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 lg:hidden">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.udi)}
                          className={cn(
                            'rounded-xl bg-white p-3 shadow-sm border-2 cursor-pointer transition-colors',
                            selectedUdis.has(item.udi) ? 'border-primary-400 bg-primary-50' : 'border-transparent',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2',
                              selectedUdis.has(item.udi) ? 'border-primary-600 bg-primary-600' : 'border-gray-300',
                            )}>
                              {selectedUdis.has(item.udi) && <Check size={14} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.productLabel || 'Unknown'}</p>
                              <p className="text-xs font-mono text-gray-500 truncate">{item.udi}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs text-gray-400">LOT: {item.lot}</span>
                                <ExpiryBadge expDate={item.expDate} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden lg:block rounded-2xl bg-white shadow-sm overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b text-gray-500">
                            <th className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={selectedUdis.size === items.length && items.length > 0}
                                onChange={(e) => e.target.checked ? selectAll() : selectNone()}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </th>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">UDI</th>
                            <th className="px-4 py-3">LOT</th>
                            <th className="px-4 py-3">Expiry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => toggleItem(item.udi)}
                              className={cn(
                                'border-b cursor-pointer transition-colors',
                                selectedUdis.has(item.udi) ? 'bg-primary-50' : 'hover:bg-gray-50',
                              )}
                            >
                              <td className="px-4 py-3">
                                <input type="checkbox" checked={selectedUdis.has(item.udi)} readOnly className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                              </td>
                              <td className="px-4 py-3 font-medium">{item.productLabel || 'Unknown'}</td>
                              <td className="px-4 py-3 font-mono">{item.udi}</td>
                              <td className="px-4 py-3">{item.lot}</td>
                              <td className="px-4 py-3"><ExpiryBadge expDate={item.expDate} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            {selectedUdis.size > 0 && toDistId && (
              <div className="sticky bottom-20 lg:bottom-4 z-30">
                <button
                  onClick={() => setStep('confirm')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-4 text-base font-semibold text-white shadow-lg hover:bg-primary-700 transition-colors"
                >
                  <ArrowRightLeft size={20} />
                  Review Transfer ({selectedUdis.size} items)
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Transfer</h3>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 mb-1">From</p>
                  <p className="text-base font-semibold text-gray-900">{fromDist?.name}</p>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRightLeft size={24} className="text-primary-600" />
                </div>
                <div className="rounded-xl bg-primary-50 p-3">
                  <p className="text-xs text-primary-500 mb-1">To</p>
                  <p className="text-base font-semibold text-primary-900">{toDist?.name}</p>
                </div>
              </div>
              {note && <p className="text-sm text-gray-500 mb-4">Note: {note}</p>}
              <p className="text-sm font-medium text-gray-700 mb-2">
                {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} to transfer:
              </p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200">
                {selectedItems.map((item, idx) => (
                  <div key={item.id} className={cn('flex items-center justify-between px-4 py-2 text-sm', idx > 0 && 'border-t')}>
                    <div>
                      <span className="font-medium">{item.productLabel || 'Unknown'}</span>
                      <span className="ml-2 font-mono text-gray-500">{item.udi}</span>
                    </div>
                    <span className="text-gray-400">LOT: {item.lot}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-3">
                <button onClick={() => setStep('select')} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100">Back</button>
                <button
                  onClick={() => transferMutation.mutate()}
                  disabled={transferMutation.isPending}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {transferMutation.isPending ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 'done' && savedTransfer && (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4 text-center">
              <Check size={32} className="mx-auto text-green-600 mb-2" />
              <p className="text-lg font-bold text-green-800">Transfer Complete</p>
              <p className="text-base font-mono text-green-700 mt-1">{savedTransfer.transferId}</p>
              <p className="text-sm text-green-600 mt-1">
                {savedTransfer.itemCount} items: {savedTransfer.fromDistributorName} → {savedTransfer.toDistributorName}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700"
              >
                <Printer size={20} />
                Print / Save PDF
              </button>
              <button onClick={resetAll} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50">
                New Transfer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PRINT-ONLY: Compact Transfer Report */}
      {savedTransfer && (
        <div className="hidden print:block">
          <div className="max-w-[700px] mx-auto">
            <div className="mb-3 flex items-center justify-between border-b border-gray-800 pb-2">
              <div>
                <p className="text-base font-bold">Summa Orthopaedics</p>
                <p className="text-xs text-gray-600">Inventory Transfer Report</p>
              </div>
              <div className="text-right text-xs text-gray-600">
                <p className="font-semibold">{savedTransfer.transferId}</p>
                <p>{new Date(savedTransfer.createdAt).toLocaleDateString()} {new Date(savedTransfer.createdAt).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded border border-gray-400 px-2 py-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase">From: </span>
                <span className="font-bold">{savedTransfer.fromDistributorName}</span>
              </div>
              <div className="rounded border border-gray-400 px-2 py-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase">To: </span>
                <span className="font-bold">{savedTransfer.toDistributorName}</span>
              </div>
            </div>

            {savedTransfer.note && (
              <p className="mb-2 text-xs"><strong>Note:</strong> {savedTransfer.note}</p>
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
                {(savedTransfer.items as any[]).map((item: any, idx: number) => (
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
              Total: <strong>{savedTransfer.itemCount}</strong> items &middot; Summa Orthopaedics Inventory v{APP_VERSION}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
