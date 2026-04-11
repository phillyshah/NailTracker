import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Plus, Boxes, Trash2, ArrowRightLeft, ChevronRight } from 'lucide-react';
import { listBanks, createBank, deleteBank, transferBankToDistributor } from '../api/banks';
import { listDistributors } from '../api/distributors';
import { HelpBanner } from '../components/HelpBanner';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function Banks() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDistId, setNewDistId] = useState('');
  const [transferBankId, setTransferBankId] = useState('');
  const [transferDistId, setTransferDistId] = useState('');

  const { data: banks = [], isLoading } = useQuery({ queryKey: ['banks'], queryFn: listBanks });
  const { data: distributors = [] } = useQuery({ queryKey: ['distributors'], queryFn: listDistributors });

  const createMutation = useMutation({
    mutationFn: () => createBank({ name: newName.trim(), description: newDesc.trim() || undefined, distributorId: newDistId || undefined }),
    onSuccess: () => {
      addToast('Bank created', 'success');
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewDistId('');
      queryClient.invalidateQueries({ queryKey: ['banks'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBank(id),
    onSuccess: () => {
      addToast('Bank deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['banks'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const transferMutation = useMutation({
    mutationFn: () => transferBankToDistributor(transferBankId, transferDistId),
    onSuccess: (data) => {
      addToast(`${data.transferred} items moved`, 'success');
      setTransferBankId('');
      setTransferDistId('');
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Banks</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus size={18} /> New Bank
        </button>
      </div>

      <HelpBanner storageKey="banks">
        Banks are named groups of inventory items. Create a bank, add items to it, then move the entire bank between distributors as a unit.
      </HelpBanner>

      {/* Create bank panel */}
      {showCreate && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Create New Bank</h3>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Bank name (e.g., Q2 Shipment, Case 47)"
            className="mb-2 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="mb-2 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
          />
          <select
            value={newDistId}
            onChange={(e) => setNewDistId(e.target.value)}
            className="mb-3 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-primary-500 focus:outline-none"
          >
            <option value="">No distributor (unassigned)</option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Bank'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Banks list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : banks.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <Boxes size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-base text-gray-500">No banks yet</p>
          <p className="text-sm text-gray-400 mt-1">Create a bank to group inventory items together</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banks.map((bank) => (
            <div key={bank.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => navigate(`/banks/${bank.id}`)}
                  className="text-left flex-1"
                >
                  <h3 className="text-base font-bold text-gray-900">{bank.name}</h3>
                  {bank.description && (
                    <p className="text-sm text-gray-500">{bank.description}</p>
                  )}
                </button>
                <ChevronRight size={20} className="text-gray-400 shrink-0" />
              </div>

              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                  {bank._count?.items ?? 0} items
                </span>
                <span>{bank.distributor?.name || 'Unassigned'}</span>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setTransferBankId(bank.id);
                    setTransferDistId(bank.distributorId || '');
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ArrowRightLeft size={16} /> Move Bank
                </button>
                <button
                  onClick={() => navigate(`/banks/${bank.id}`)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  View Items
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete bank "${bank.name}"? Items will be unlinked, not deleted.`)) {
                      deleteMutation.mutate(bank.id);
                    }
                  }}
                  className="rounded-xl border border-red-200 p-2 text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transfer bank modal */}
      {transferBankId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setTransferBankId('')}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Move Bank to Distributor</h3>
            <p className="text-sm text-gray-500 mb-3">
              All items in this bank will be reassigned to the selected distributor.
            </p>
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
              <button onClick={() => setTransferBankId('')} className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100">Cancel</button>
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
