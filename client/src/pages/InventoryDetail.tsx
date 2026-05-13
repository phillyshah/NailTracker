import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRightLeft, Trash2, CheckCircle2, Image, X, Pencil } from 'lucide-react';
import { getItem, reassignItem, deleteItem, markAsUsed, editItem, type EditItemPayload } from '../api/inventory';
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
  const [showImage, setShowImage] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [newDistId, setNewDistId] = useState('');
  const [note, setNote] = useState('');
  const [editForm, setEditForm] = useState<EditItemPayload>({});

  // ESC closes the topmost open overlay: image > edit > reassign.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showImage) setShowImage(false);
      else if (showEdit) setShowEdit(false);
      else if (showReassign) setShowReassign(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showImage, showEdit, showReassign]);

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

  const useMutation_ = useMutation({
    mutationFn: () => markAsUsed(udi!),
    onSuccess: () => {
      addToast('Item marked as used', 'success');
      queryClient.invalidateQueries({ queryKey: ['inventory-item', udi] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
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

  const buildEditPayload = (extra?: Partial<EditItemPayload>): EditItemPayload => {
    const original = {
      gtin: item?.gtin ?? '',
      lot: item?.lot ?? '',
      expDate: item?.expDate ? item.expDate.slice(0, 10) : null,
      itemNumber: item?.itemNumber || '',
      productLabel: item?.productLabel || '',
    };
    const payload: EditItemPayload = {};
    if ((editForm.gtin ?? '') !== original.gtin) payload.gtin = editForm.gtin;
    if ((editForm.lot ?? '') !== original.lot) payload.lot = editForm.lot;
    if ((editForm.expDate ?? null) !== original.expDate) payload.expDate = editForm.expDate;
    if ((editForm.itemNumber ?? '') !== original.itemNumber) payload.itemNumber = editForm.itemNumber;
    if ((editForm.productLabel ?? '') !== original.productLabel) payload.productLabel = editForm.productLabel;
    return { ...payload, ...(extra ?? {}) };
  };

  const handleEditSuccess = (res: { data?: { udi: string; merged?: boolean } }) => {
    const newUdi = res?.data?.udi;
    const merged = res?.data?.merged;
    addToast(merged ? 'Duplicate merged — showing the original' : 'Item updated', 'success');
    setShowEdit(false);
    setEditForm({});
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    if (newUdi && newUdi !== udi) {
      navigate(`/inventory/${encodeURIComponent(newUdi)}`, { replace: true });
    } else {
      queryClient.invalidateQueries({ queryKey: ['inventory-item', udi] });
    }
  };

  const editMutation = useMutation({
    mutationFn: () => editItem(udi!, buildEditPayload()),
    onSuccess: handleEditSuccess,
    onError: (err: Error & { conflictUdi?: string; status?: number }) => {
      if (err.status === 409 && err.conflictUdi) {
        const ok = confirm(
          `Another item already exists with UDI ${err.conflictUdi}. ` +
            `This is likely a duplicate scan of the same product/lot.\n\n` +
            `Delete this entry and keep the existing one?`,
        );
        if (ok) mergeMutation.mutate(err.conflictUdi);
        return;
      }
      addToast(err.message, 'error');
    },
  });

  const mergeMutation = useMutation({
    mutationFn: (_conflictUdi: string) => editItem(udi!, buildEditPayload({ mergeIfConflict: true })),
    onSuccess: handleEditSuccess,
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
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <button
        onClick={() => navigate('/inventory')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to Inventory
      </button>

      {/* Used badge */}
      {item.usedAt && (
        <div className="mb-4 rounded-2xl bg-amber-50 border-2 border-amber-300 px-4 py-3 text-center">
          <p className="text-base font-semibold text-amber-800">
            This item has been marked as used (implanted)
          </p>
          <p className="text-sm text-amber-600">
            {new Date(item.usedAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Item photo */}
      {item.imageData && (
        <div className="mb-4">
          <button
            onClick={() => setShowImage(!showImage)}
            className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 mb-2"
          >
            <Image size={18} />
            {showImage ? 'Hide Photo' : 'View Barcode Photo'}
          </button>
          {showImage && (
            <img
              src={item.imageData}
              alt="Barcode label"
              className="w-full rounded-2xl shadow-sm"
            />
          )}
        </div>
      )}

      {/* Item details card */}
      <div className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {item.productLabel || 'Unknown Product'}
        </h2>
        <p className="text-sm text-gray-500 font-mono mb-4">{item.udi}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="Item Number (REF)" value={item.itemNumber || '—'} />
          <DetailRow label="GTIN" value={item.gtin} />
          <DetailRow label="GTIN Short" value={item.gtinShort} />
          <DetailRow label="Lot Number" value={item.lot} />
          <div>
            <span className="text-sm text-gray-500">Expiry</span>
            <div className="mt-0.5">
              <ExpiryBadge expDate={item.expDate} showDate />
            </div>
          </div>
          <DetailRow
            label="Distributor"
            value={item.distributor?.name || 'Unassigned'}
          />
          <DetailRow
            label="Assigned"
            value={item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : '\u2014'}
          />
          <DetailRow label="Assigned By" value={item.assignedBy || '\u2014'} />
          <DetailRow
            label="Added"
            value={new Date(item.createdAt).toLocaleDateString()}
          />
          {item.usedAt && (
            <DetailRow
              label="Used"
              value={new Date(item.usedAt).toLocaleDateString()}
            />
          )}
        </div>

        {!item.usedAt && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setEditForm({
                  gtin: item.gtin,
                  lot: item.lot,
                  expDate: item.expDate ? item.expDate.slice(0, 10) : null,
                  itemNumber: item.itemNumber || '',
                  productLabel: item.productLabel || '',
                });
                setShowEdit(true);
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary-300 bg-white px-4 py-3 text-base font-semibold text-primary-700 hover:bg-primary-50"
            >
              <Pencil size={20} /> Edit
            </button>
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
                if (confirm('Mark this item as used (implanted)?')) {
                  useMutation_.mutate();
                }
              }}
              disabled={useMutation_.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-base font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <CheckCircle2 size={20} /> Mark Used
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
        )}
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
                    {' \u2192 '}
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

      {/* Edit panel */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Edit Item</h3>
            <p className="text-sm text-gray-500 mb-4">
              Correct any field below. Entering a known Item Number (REF) will auto-fix the GTIN and product label.
            </p>
            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Item Number (REF)</span>
              <input
                type="text"
                value={editForm.itemNumber ?? ''}
                onChange={(e) => setEditForm({ ...editForm, itemNumber: e.target.value })}
                placeholder="e.g. SO-S50I-SO-034-T"
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-primary-500 focus:outline-none"
              />
            </label>
            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">GTIN (14 digits)</span>
              <input
                type="text"
                value={editForm.gtin ?? ''}
                onChange={(e) => setEditForm({ ...editForm, gtin: e.target.value })}
                placeholder="08800089461684"
                maxLength={14}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-primary-500 focus:outline-none"
              />
            </label>
            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Lot Number</span>
              <input
                type="text"
                value={editForm.lot ?? ''}
                onChange={(e) => setEditForm({ ...editForm, lot: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-primary-500 focus:outline-none"
              />
            </label>
            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Expiry Date</span>
              <input
                type="date"
                value={editForm.expDate ?? ''}
                onChange={(e) => setEditForm({ ...editForm, expDate: e.target.value || null })}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
              />
            </label>
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700">Product Label</span>
              <input
                type="text"
                value={editForm.productLabel ?? ''}
                onChange={(e) => setEditForm({ ...editForm, productLabel: e.target.value })}
                placeholder="Auto-derived from GTIN/REF if left as default"
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
              />
              <span className="text-xs text-gray-500 mt-1 block">
                Leave as the auto-derived value unless you need a manual override.
              </span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEdit(false);
                  setEditForm({});
                }}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Full-screen image view */}
      {showImage && item.imageData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowImage(false)}
        >
          <button
            onClick={() => setShowImage(false)}
            className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30 z-10"
            aria-label="Close"
          >
            <X size={28} />
          </button>
          <img
            src={item.imageData}
            alt="Barcode label"
            className="max-h-[80vh] max-w-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
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
