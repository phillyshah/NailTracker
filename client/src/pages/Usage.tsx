import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Keyboard,
  Trash2,
  ClipboardCheck,
  ArrowLeft,
  History,
} from 'lucide-react';
import { listDistributors } from '../api/distributors';
import { previewUsage, commitUsage, type UsageLine, type UsageCommitResult } from '../api/usage';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { ToastContainer } from '../components/Toast';
import { HelpBanner } from '../components/HelpBanner';
import { useToast } from '../hooks/useToast';

export default function Usage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();

  const [distributorId, setDistributorId] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [lines, setLines] = useState<UsageLine[]>([]);
  const [manualEntry, setManualEntry] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'scan' | 'confirm' | 'done'>('scan');
  const [result, setResult] = useState<UsageCommitResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const homeOffice = distributors.find(
    (d) => d.name === 'Home Office' || d.name === 'Home Office (HQ)',
  );

  // Re-resolve the whole ticket against the distributor's stock. Sending the
  // full barcode list each time lets the server dedup identical stickers across
  // the ticket and keep availability counts correct.
  async function refreshPreview(nextBarcodes: string[]) {
    if (!distributorId || nextBarcodes.length === 0) {
      setLines([]);
      return;
    }
    setPreviewing(true);
    try {
      const res = await previewUsage(distributorId, nextBarcodes);
      setLines(res.lines);
      setDistributorName(res.distributorName);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not check stock', 'error');
    } finally {
      setPreviewing(false);
    }
  }

  function addBarcode(raw: string) {
    const barcode = raw.trim();
    if (!barcode) return;
    if (!distributorId) {
      addToast('Pick a distributor first', 'error');
      return;
    }
    const next = [...barcodes, barcode];
    setBarcodes(next);
    refreshPreview(next);
  }

  function removeLine(index: number) {
    const next = barcodes.filter((_, i) => i !== index);
    setBarcodes(next);
    refreshPreview(next);
  }

  function changeDistributor(id: string) {
    if (barcodes.length > 0) {
      if (!confirm('Changing the distributor will clear the scanned items. Continue?')) return;
    }
    setDistributorId(id);
    setDistributorName(distributors.find((d) => d.id === id)?.name ?? '');
    setBarcodes([]);
    setLines([]);
  }

  function resetTicket() {
    setBarcodes([]);
    setLines([]);
    setNote('');
    setResult(null);
    setStep('scan');
  }

  const availableLines = lines.filter((l) => l.status === 'available');
  const notInStockCount = lines.filter((l) => l.status === 'not_in_stock').length;
  const errorCount = lines.filter((l) => l.status === 'error').length;

  const commitMutation = useMutation({
    mutationFn: () => {
      const itemIds = availableLines.map((l) => l.matchedItemId!).filter(Boolean);
      return commitUsage(distributorId, itemIds, note || undefined);
    },
    onSuccess: (data) => {
      setResult(data);
      setStep('done');
      addToast(`Consumed ${data.consumed} item${data.consumed !== 1 ? 's' : ''} — ${data.ticketId}`, 'success');
      if (data.blocked.length > 0) {
        addToast(`${data.blocked.length} item(s) skipped (no longer available)`, 'info');
      }
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  // ---- DONE screen ---------------------------------------------------------
  if (step === 'done' && result) {
    return (
      <div className="mx-auto max-w-2xl lg:max-w-4xl">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="rounded-2xl bg-white p-6 shadow-sm text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-600" />
          <h2 className="mt-3 text-xl font-bold text-gray-900">Usage recorded</h2>
          <p className="mt-1 text-base text-gray-600">
            {result.consumed} item{result.consumed !== 1 ? 's' : ''} consumed from {distributorName}
          </p>
          <p className="mt-1 font-mono text-base text-green-700">{result.ticketId}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate(`/usage/history/${encodeURIComponent(result.ticketId)}`)}
              className="rounded-xl bg-primary-600 px-5 py-3 text-base font-semibold text-white hover:bg-primary-700"
            >
              View ticket
            </button>
            <button
              onClick={resetTicket}
              className="rounded-xl border border-gray-300 px-5 py-3 text-base font-medium text-gray-700 hover:bg-gray-100"
            >
              Record another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- CONFIRM screen ------------------------------------------------------
  if (step === 'confirm') {
    return (
      <div className="mx-auto max-w-2xl lg:max-w-4xl">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <button
          onClick={() => setStep('scan')}
          className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={20} /> Back
        </button>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Confirm usage</h2>
          <p className="text-sm text-gray-500 mb-4">
            Deduct {availableLines.length} item{availableLines.length !== 1 ? 's' : ''} from{' '}
            <span className="font-semibold text-gray-700">{distributorName}</span>
          </p>

          <div className="space-y-2 mb-4">
            {availableLines.map((l, idx) => (
              <div key={idx} className="rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{l.productLabel || 'Unknown'}</p>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>{l.itemNumber || '—'}</span>
                  <span>LOT: {l.lot}</span>
                  <ExpiryBadge expDate={l.expDate ?? null} showDate />
                </div>
              </div>
            ))}
          </div>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Case #, surgeon, ticket reference"
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
            />
          </label>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('scan')}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-100"
            >
              Back
            </button>
            <button
              onClick={() => commitMutation.mutate()}
              disabled={commitMutation.isPending || availableLines.length === 0}
              className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {commitMutation.isPending ? 'Recording…' : `Consume ${availableLines.length}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- SCAN screen ---------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Record Usage</h2>
        <button
          onClick={() => navigate('/usage/history')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600"
        >
          <History size={18} /> History
        </button>
      </div>

      <HelpBanner storageKey="usage">
        Pick the distributor, then scan each product sticker from the usage ticket. We check every
        item against that distributor's inventory before deducting it. Each sticker consumes one
        unit (oldest expiry first).
      </HelpBanner>

      {/* Distributor */}
      <div className="rounded-2xl bg-white p-4 shadow-sm mb-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Distributor</span>
          <select
            value={distributorId}
            onChange={(e) => changeDistributor(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none bg-white"
          >
            <option value="">Select a distributor…</option>
            {homeOffice && <option value={homeOffice.id}>{homeOffice.name}</option>}
            {distributors
              .filter((d) => d.id !== homeOffice?.id && d.active)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        {barcodes.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">
            Deducting from {distributorName}. Change the distributor to start a new ticket.
          </p>
        )}
      </div>

      {/* Scanner */}
      {distributorId ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm mb-4">
          <BarcodeScanner
            onResult={(barcode) => addBarcode(barcode)}
            onError={(msg) => {
              addToast(msg, 'info');
              setShowManual(true);
            }}
          />

          {/* Manual entry fallback */}
          <button
            onClick={() => setShowManual((v) => !v)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50"
          >
            <Keyboard size={20} />
            Enter barcode manually
          </button>
          {showManual && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addBarcode(manualEntry);
                setManualEntry('');
              }}
              className="mt-3 flex gap-2"
            >
              <input
                type="text"
                value={manualEntry}
                onChange={(e) => setManualEntry(e.target.value)}
                placeholder="Paste or type the barcode"
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-primary-600 px-5 py-3 text-base font-semibold text-white hover:bg-primary-700"
              >
                Add
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500 mb-4">
          Select a distributor above to start scanning.
        </div>
      )}

      {/* Scanned lines */}
      {lines.length > 0 && (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge label="Available" count={availableLines.length} color="green" />
            {notInStockCount > 0 && <Badge label="Not in stock" count={notInStockCount} color="amber" />}
            {errorCount > 0 && <Badge label="Unreadable" count={errorCount} color="red" />}
            {previewing && <span className="text-xs text-gray-400 self-center">Checking…</span>}
          </div>

          <div className="space-y-2 mb-4">
            {lines.map((l, idx) => (
              <div
                key={idx}
                className={`rounded-2xl bg-white p-3 shadow-sm border-2 ${
                  l.status === 'available'
                    ? 'border-green-200 bg-green-50'
                    : l.status === 'not_in_stock'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {l.status === 'available' && <CheckCircle2 size={20} className="text-green-600" />}
                    {l.status === 'not_in_stock' && <AlertTriangle size={20} className="text-amber-500" />}
                    {l.status === 'error' && <XCircle size={20} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {l.status === 'error' ? (
                      <>
                        <p className="text-sm font-medium text-red-700">Couldn't read this sticker</p>
                        <p className="text-xs text-red-500">{l.errorMessage}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-gray-900">{l.productLabel || 'Unknown'}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span>{l.itemNumber || '—'}</span>
                          <span>LOT: {l.lot}</span>
                          <ExpiryBadge expDate={l.expDate ?? null} showDate />
                        </div>
                        {l.status === 'not_in_stock' ? (
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            Not in {distributorName}'s stock — cannot deduct
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-gray-400">
                            Oldest-expiry unit auto-selected
                            {typeof l.availableCount === 'number' && l.availableCount > 1
                              ? ` · ${l.availableCount} in stock`
                              : ''}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => removeLine(idx)}
                    className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sticky consume button */}
      {availableLines.length > 0 && (
        <div className="sticky bottom-20 lg:bottom-4">
          <button
            onClick={() => setStep('confirm')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-4 text-base font-semibold text-white shadow-lg hover:bg-green-700"
          >
            <ClipboardCheck size={20} />
            Consume {availableLines.length} item{availableLines.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${colors[color]}`}>
      {count} {label}
    </span>
  );
}
