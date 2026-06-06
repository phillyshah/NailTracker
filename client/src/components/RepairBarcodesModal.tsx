import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ScanLine, Check, SkipForward, Wand2, CheckCircle2 } from 'lucide-react';
import { reparsePreview, reparseApply, type ReparseCandidate } from '../api/inventory';
import { formatExpiry } from '../utils/expiry';

/**
 * Interactive "Repair Barcodes" stepper. Walks the admin through each item
 * whose stored lot/expiry disagrees with its barcode — one at a time, like
 * Find & Replace: Repair this one, Skip it, or Repair all remaining.
 */
export default function RepairBarcodesModal({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [repaired, setRepaired] = useState(0);
  const [skipped, setSkipped] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reparse-preview'],
    queryFn: reparsePreview,
  });

  const candidates: ReparseCandidate[] = data?.data?.candidates ?? [];
  const current = candidates[index];
  const remaining = candidates.slice(index);
  const done = !isLoading && !isError && index >= candidates.length;

  function finish() {
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    onClose();
  }

  const applyOne = useMutation({
    mutationFn: (id: string) => reparseApply([id]),
    onSuccess: () => {
      setRepaired((n) => n + 1);
      setIndex((i) => i + 1);
    },
    onError: (err: Error) => onToast(err.message, 'error'),
  });

  const applyRest = useMutation({
    mutationFn: (ids: string[]) => reparseApply(ids),
    onSuccess: (res) => {
      const n = res.data?.updated ?? 0;
      onToast(`Repaired ${repaired + n} item${repaired + n === 1 ? '' : 's'}`, 'success');
      finish();
    },
    onError: (err: Error) => onToast(err.message, 'error'),
  });

  const busy = applyOne.isPending || applyRest.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine size={20} className="text-primary-600" />
            <h3 className="text-lg font-bold text-gray-900">Repair Barcodes</h3>
          </div>
          <button onClick={done ? finish : onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            <p className="text-sm text-gray-500">Scanning inventory for items to repair…</p>
          </div>
        )}

        {isError && (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">Could not load items to repair. Please try again.</p>
            <button onClick={onClose} className="mt-4 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100">
              Close
            </button>
          </div>
        )}

        {/* Nothing to do */}
        {!isLoading && !isError && candidates.length === 0 && (
          <div className="py-8 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-green-500" />
            <p className="text-base font-semibold text-gray-900">No items need repair</p>
            <p className="mt-1 text-sm text-gray-500">Every barcode already matches its stored details.</p>
            <button onClick={onClose} className="mt-5 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              Done
            </button>
          </div>
        )}

        {/* Summary when finished walking the list */}
        {done && candidates.length > 0 && (
          <div className="py-8 text-center">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-green-500" />
            <p className="text-base font-semibold text-gray-900">All done</p>
            <p className="mt-1 text-sm text-gray-500">
              Repaired {repaired} · Skipped {skipped}
            </p>
            <button onClick={finish} className="mt-5 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              Close
            </button>
          </div>
        )}

        {/* The current item under review */}
        {!done && current && (
          <>
            <p className="mb-3 text-sm text-gray-500">
              Item {index + 1} of {candidates.length}
              {repaired + skipped > 0 && (
                <span className="ml-2 text-gray-400">· {repaired} repaired · {skipped} skipped</span>
              )}
            </p>

            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-mono text-gray-400 break-all">{current.rawBarcode}</p>
              <div className="mt-3 space-y-2">
                <DiffRow label="Lot" before={current.before.lot} after={current.after.lot} />
                <DiffRow label="Expiry" before={formatExpiry(current.before.expDate)} after={formatExpiry(current.after.expDate)} />
                <DiffRow label="Product" before={current.before.productLabel} after={current.after.productLabel} />
                <DiffRow label="Item #" before={current.before.itemNumber} after={current.after.itemNumber} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => { setSkipped((n) => n + 1); setIndex((i) => i + 1); }}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <SkipForward size={18} /> Skip
              </button>
              <button
                onClick={() => applyOne.mutate(current.id)}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Check size={18} /> {applyOne.isPending ? 'Repairing…' : 'Repair'}
              </button>
            </div>
            <button
              onClick={() => applyRest.mutate(remaining.map((c) => c.id))}
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary-300 px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-50"
            >
              <Wand2 size={18} />
              {applyRest.isPending ? 'Repairing…' : `Repair all remaining (${remaining.length})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** One before → after row; highlights only when the value actually changed. */
function DiffRow({ label, before, after }: { label: string; before: string | null; after: string | null }) {
  const changed = (before ?? '') !== (after ?? '');
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="w-16 shrink-0 text-xs font-medium text-gray-500">{label}</span>
      {changed ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-red-500 line-through">{before || '—'}</span>
          <span className="text-gray-400">→</span>
          <span className="font-semibold text-green-700">{after || '—'}</span>
        </span>
      ) : (
        <span className="text-gray-700">{after || '—'}</span>
      )}
    </div>
  );
}
