import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, ArrowRightLeft } from 'lucide-react';
import { getBank, addItemsToBank, removeItemsFromBank, transferBankToDistributor } from '../api/banks';
import { listInventory } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { cn } from '../utils/cn';

export default function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [showAddItems, setShowAddItems] = useState(false);
  const [selectedUdis, setSelectedUdis] = useState<Set<string>>(new Set());
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferDistId, setTransferDistId] = useState('');

  const { data: bank, isLoading } = useQuery({
    queryKey: ['bank', id],
    queryFn: () => getBank(id!),
    enabled: !!id,
  });

  const { data: distributors = [] } = useQuery({ queryKey: ['distributors'], queryFn: listDistributors });

  // Items NOT in any bank (available to add)
  const { data: availableData } = useQuery({
    queryKey: ['inventory', { limit: 200 }],
    queryFn: () => listInventory({ limit: 200 }),
    enabled: showAddItems,
  });
  const availableItems = (availableData?.data ?? []).filter((i) => !i.bankId);

  const addMutation = useMutation({
    mutationFn: () => addItemsToBank(id!, [...selectedUdis]),
    onSuccess: (data) => {
      addToast(`${data.updated} items added to bank`, 'success');
      setShowAddItems(false);
      setSelectedUdis(new Set());
      queryClient.invalidateQueries({ queryKey: ['bank', id] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (udi: string) => removeItemsFromBank(id!, [udi]),
    onSuccess: () => {
      addToast('Item removed from bank', 'success');
      queryClient.invalidateQueries({ queryKey: ['bank', id] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const transferMutation = useMutation({
    mutationFn: () => transferBankToDistributor(id!, transferDistId),
    onSuccess: (data) => {
      addToast(`${data.transferred} items moved`, 'success');
      setShowTransfer(false);
      queryClient.invalidateQueries({ queryKey: ['bank', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!bank) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-500">Bank not found</p>
      </div>
    );
  }

  const bankItems = bank.items || [];

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <button onClick={() => navigate('/banks')} className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700">
        <ArrowLeft size={20} /> Back to Banks
      </button>

      {/* Bank header */}
      <div className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <h2 className="text-xl font-bold text-gray-900">{bank.name}</h2>
        {bank.description && <p className="text-sm text-gray-500 mt-1">{bank.description}</p>}
        <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
          <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
            {bankItems.length} items
          </span>
          <span>{bank.distributor?.name || 'Unassigned'}</span>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setShowAddItems(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700"
          >
            <Plus size={20} /> Add Items
          </button>
          <button
            onClick={() => {
              setShowTransfer(true);
              setTransferDistId(bank.distributorId || '');
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowRightLeft size={20} /> Move Bank
          </button>
        </div>
      </div>

      {/* Bank items */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-gray-900">Items in Bank</h3>
        {bankItems.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No items in this bank yet. Tap "Add Items" to get started.</p>
        ) : (
          <div className="space-y-2">
            {bankItems.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.productLabel || 'Unknown'}</p>
                  <p className="text-xs font-mono text-gray-500 truncate">{item.udi}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-400">LOT: {item.lot}</span>
                    <ExpiryBadge expDate={item.expDate} />
                  </div>
                </div>
                <button
                  onClick={() => removeMutation.mutate(item.udi)}
                  className="shrink-0 rounded-lg p-2 text-gray-300 hover:text-red-500 hover:bg-red-50"
                  title="Remove from bank"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add items modal */}
      {showAddItems && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowAddItems(false)}>
          <div className="w-full sm:max-w-lg max-h-[80vh] rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Add Items to {bank.name}</h3>
            <p className="text-sm text-gray-500 mb-3">Select items to add ({selectedUdis.size} selected)</p>

            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {availableItems.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">All items are already in a bank</p>
              ) : (
                availableItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedUdis((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.udi)) next.delete(item.udi);
                        else next.add(item.udi);
                        return next;
                      });
                    }}
                    className={cn(
                      'rounded-xl border-2 p-3 cursor-pointer transition-colors',
                      selectedUdis.has(item.udi) ? 'border-primary-400 bg-primary-50' : 'border-gray-200',
                    )}
                  >
                    <p className="text-sm font-semibold text-gray-900">{item.productLabel || 'Unknown'}</p>
                    <p className="text-xs font-mono text-gray-500">{item.udi}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowAddItems(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100">Cancel</button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={selectedUdis.size === 0 || addMutation.isPending}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {addMutation.isPending ? 'Adding...' : `Add ${selectedUdis.size} Items`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowTransfer(false)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Move Bank to Distributor</h3>
            <p className="text-sm text-gray-500 mb-3">All {bankItems.length} items will be moved.</p>
            <select
              value={transferDistId}
              onChange={(e) => setTransferDistId(e.target.value)}
              className="mb-4 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-primary-500 focus:outline-none"
            >
              <option value="">Select distributor...</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowTransfer(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100">Cancel</button>
              <button
                onClick={() => transferMutation.mutate()}
                disabled={!transferDistId || transferMutation.isPending}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {transferMutation.isPending ? 'Moving...' : 'Move All Items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
