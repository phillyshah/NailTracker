import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, ArrowRightLeft, Pencil } from 'lucide-react';
import { getBank, addItemsToBank, removeItemsFromBank, transferBankToDistributor, updateBank } from '../api/banks';
import { listAllInventory } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { HelpBanner } from '../components/HelpBanner';
import { SearchBar } from '../components/SearchBar';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { cn } from '../utils/cn';
import { matchesItemSearch } from '../utils/itemSearch';

export default function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [showAddItems, setShowAddItems] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickerSearch, setPickerSearch] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferDistId, setTransferDistId] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { data: bank, isLoading } = useQuery({
    queryKey: ['bank', id],
    queryFn: () => getBank(id!),
    enabled: !!id,
  });

  const { data: distributors = [] } = useQuery({ queryKey: ['distributors'], queryFn: listDistributors });

  // Items at the same distributor, not in any bank (available to add). Fetch the
  // FULL set so the picker isn't silently capped at the server's first 100.
  const { data: availableData } = useQuery({
    queryKey: ['inventory-all', { distributorId: bank?.distributorId }],
    queryFn: () => listAllInventory({ distributorId: bank?.distributorId || undefined }),
    enabled: showAddItems && !!bank,
  });
  const availableItems = (availableData ?? []).filter((i) => !i.bankId);
  const visibleAvailable = availableItems.filter((i) => matchesItemSearch(i, pickerSearch));

  const addMutation = useMutation({
    mutationFn: () => addItemsToBank(id!, { itemIds: [...selectedIds] }),
    onSuccess: (data) => {
      addToast(`${data.updated} items added to bank`, 'success');
      setShowAddItems(false);
      setSelectedIds(new Set());
      setPickerSearch('');
      queryClient.invalidateQueries({ queryKey: ['bank', id] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeItemsFromBank(id!, [itemId]),
    onSuccess: () => {
      addToast('Item removed from bank', 'success');
      queryClient.invalidateQueries({ queryKey: ['bank', id] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const editMutation = useMutation({
    mutationFn: () => updateBank(id!, { name: editName.trim(), description: editDesc.trim() || undefined }),
    onSuccess: () => {
      addToast('Bank updated', 'success');
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ['bank', id] });
      queryClient.invalidateQueries({ queryKey: ['banks'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const transferMutation = useMutation({
    mutationFn: () => transferBankToDistributor(id!, transferDistId),
    onSuccess: (data) => {
      addToast(
        `${data.transferred} items moved to ${data.toDistributorName}${data.transferId ? ` — ${data.transferId}` : ''}`,
        'success',
      );
      setShowTransfer(false);
      setTransferDistId('');
      queryClient.invalidateQueries({ queryKey: ['bank', id] });
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-all'] });
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

      <HelpBanner storageKey="bank-detail">
        A bank is a named group of items at this distributor. Use <strong>Add Items</strong> to put stock into the bank, or <strong>Move Bank</strong> to transfer the whole group to another distributor at once.
      </HelpBanner>

      {/* Bank header */}
      <div className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{bank.name}</h2>
            {bank.description && <p className="text-sm text-gray-500 mt-1">{bank.description}</p>}
          </div>
          <button
            onClick={() => {
              setEditName(bank.name);
              setEditDesc(bank.description || '');
              setShowEdit(true);
            }}
            className="shrink-0 flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Rename or edit description"
          >
            <Pencil size={16} /> Edit
          </button>
        </div>
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
              // Start empty — never preselect the current distributor, so the
              // user must actively choose a real destination.
              setTransferDistId('');
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
                  <p className="text-xs font-mono text-gray-500 truncate">{item.itemNumber || '—'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-400">LOT: {item.lot}</span>
                    <ExpiryBadge expDate={item.expDate} showDate />
                  </div>
                </div>
                <button
                  onClick={() => removeMutation.mutate(item.id)}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => { setShowAddItems(false); setPickerSearch(''); }}>
          <div className="w-full sm:max-w-lg max-h-[80vh] rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Add Items to {bank.name}</h3>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">{selectedIds.size} selected</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedIds((prev) => new Set([...prev, ...visibleAvailable.map((i) => i.id)]))}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Select All
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-500 hover:underline">Clear</button>
              </div>
            </div>

            {availableItems.length > 0 && (
              <SearchBar
                className="mb-3"
                value={pickerSearch}
                onChange={setPickerSearch}
                placeholder="Search item number, lot, or product..."
              />
            )}

            <div className="flex-1 overflow-y-auto space-y-2 mb-3">
              {availableItems.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  {bank.distributorId
                    ? `No items available to add — every item at ${bank.distributor?.name} is already in a bank. Receive or transfer stock into ${bank.distributor?.name} first, then add it here.`
                    : 'No items available to add — every item is already in a bank.'}
                </p>
              ) : visibleAvailable.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No items match "{pickerSearch}"</p>
              ) : (
                visibleAvailable.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                    }}
                    className={cn(
                      'rounded-xl border-2 p-3 cursor-pointer transition-colors',
                      selectedIds.has(item.id) ? 'border-primary-400 bg-primary-50' : 'border-gray-200',
                    )}
                  >
                    <p className="text-sm font-semibold text-gray-900">{item.productLabel || 'Unknown'}</p>
                    <p className="text-xs font-mono text-gray-500">{item.itemNumber || '—'}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setShowAddItems(false); setPickerSearch(''); }} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100">Cancel</button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={selectedIds.size === 0 || addMutation.isPending}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {addMutation.isPending ? 'Adding...' : `Add ${selectedIds.size} Items`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit bank modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowEdit(false)}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Bank</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Bank name (e.g., Trauma Cart A, Case 47)"
              className="mb-3 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
              autoFocus
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              className="mb-4 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowEdit(false)} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100">Cancel</button>
              <button
                onClick={() => editMutation.mutate()}
                disabled={!editName.trim() || editMutation.isPending}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
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
            <p className="text-sm text-gray-500 mb-3">
              All {bankItems.length} items will move from{' '}
              <strong>{bank.distributor?.name || 'Unassigned'}</strong> to the destination you pick.
            </p>
            <select
              value={transferDistId}
              onChange={(e) => setTransferDistId(e.target.value)}
              className="mb-4 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-primary-500 focus:outline-none"
            >
              <option value="">Select destination...</option>
              {distributors
                .filter((d) => d.id !== bank.distributorId)
                .map((d) => (
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
