import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRightLeft, Trash2 } from 'lucide-react';
import { getItem, reassignItem, deleteItem } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function InventoryDetail() {
  const { udi } = useParams<{ udi: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [showReassign, setShowReassign] = useState(false);
  const [newDistId, setNewDistId] = useState('');
  const [note, setNote] = useState('');

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-item', udi],
    queryFn: () => getItem(udi!),
    enabled: !!udi,
  });

  const item = data?.data;

  const reassignMutation = useMutation({
    mutationFn: () => reassignItem(udi!, newDistId || null, note || undefined),
    onSuccess: () => {
      addToast('Item reassigned', 'success');
      setShowReassign(false);
      queryClient.invalidateQueries({ queryKey: ['inventory-item', udi] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteItem(udi!),
    onSuccess: () => {
      addToast('Item deleted', 'success');
      navigate('/inventory');
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

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-500">Item not found</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <button
        onClick={() => navigate('/inventory')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to Inventory
      </button>

      {/* Item details card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {item.productLabel || 'Unknown Product'}
        </h2>
        <p className="text-sm text-gray-500 font-mono mb-4">{item.udi}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="GTIN" value={item.gtin} />
          <DetailRow label="GTIN Short" value={item.gtinShort} />
          <DetailRow label="Lot Number" value={item.lot} />
          <div>
            <span className="text-sm text-gray-500">Expiry</span>
            <div className="mt-0.5">
              <ExpiryBadge expDate={item.expDate} />
            </div>
          </div>
          <DetailRow
            label="Distributor"
            value={item.distributor?.name || 'Unassigned'}
          />
          <DetailRow
            label="Assigned"
            value={item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : '—'}
          />
          <DetailRow label="Assigned By" value={item.assignedBy || '—'} />
          <DetailRow
            label="Added"
            value={new Date(item.createdAt).toLocaleDateString()}
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => {
              setShowReassign(true);
              setNewDistId(item.distributorId || '');
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700"
          >
            <ArrowRightLeft size={20} /> Reassign
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this item? This action cannot be undone.')) {
                deleteMutation.mutate();
              }
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-300 px-4 py-3 text-base font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Assignment History */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Assignment History</h3>
        {item.history && item.history.length > 0 ? (
          <div className="space-y-4">
            {item.history.map((h) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary-400 mt-1.5" />
                  <div className="w-0.5 flex-1 bg-gray-200" />
                </div>
                <div className="pb-4">
                  <p className="text-sm text-gray-500">
                    {new Date(h.changedAt).toLocaleString()}
                    {h.changedBy && ` by ${h.changedBy}`}
                  </p>
                  <p className="text-base text-gray-900">
                    {h.fromDistributorName || 'Unassigned'}
                    {' → '}
                    {h.toDistributorName || 'Unassigned'}
                  </p>
                  {h.note && <p className="text-sm text-gray-500 italic">{h.note}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No assignment history</p>
        )}
      </div>

      {/* Reassign panel */}
      {showReassign && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Reassign Item</h3>
            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">New Distributor</span>
              <select
                value={newDistId}
                onChange={(e) => setNewDistId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-primary-500 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700">Note (optional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for reassignment"
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
              />
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReassign(false)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => reassignMutation.mutate()}
                disabled={reassignMutation.isPending}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {reassignMutation.isPending ? 'Saving...' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-sm text-gray-500">{label}</span>
      <p className="text-base text-gray-900">{value}</p>
    </div>
  );
}
