import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft,
  Check,
  Printer,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  listAllInventory,
  reassignItem,
  assignItems,
  parseSpreadsheet,
} from '../api/inventory';
import { listDistributors } from '../api/distributors';
import {
  createTransfer,
  previewBatchTransfer,
  type TransferRecord,
  type BatchLine,
} from '../api/transfers';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { APP_VERSION } from '../version';
import { cn } from '../utils/cn';
import { HelpBanner } from '../components/HelpBanner';
import { formatExpiry } from '../utils/expiry';
import { countByStatus, buildTransferItems, isTransferable } from '../utils/transferBatch';

/**
 * Shape of an item entry in the per-row review and the persisted Transfer
 * record. Both modes (pick / excel) project into this so the confirm step and
 * the printed report can stay shared.
 */
interface ReviewItem {
  id: string;
  udi: string;
  itemNumber: string | null;
  productLabel: string | null;
  lot: string;
  gtin: string;
  expDate: string | null;
}

type Mode = 'pick' | 'excel';

export default function Transfer() {
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();

  const [mode, setMode] = useState<Mode>('pick');
  const [step, setStep] = useState<'select' | 'confirm' | 'done'>('select');
  const [fromDistId, setFromDistId] = useState('');
  const [toDistId, setToDistId] = useState('');
  const [note, setNote] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedTransfer, setSavedTransfer] = useState<TransferRecord | null>(null);

  // Excel mode state — preview lines, the user's per-row exclusions, the file
  // input ref, and any rows the commit step had to skip (the source-guard race).
  const [batchLines, setBatchLines] = useState<BatchLine[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [blockedLines, setBlockedLines] = useState<BatchLine[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const { data: inventoryData, isLoading: loadingItems } = useQuery({
    // Fetch ALL of the source distributor's items so Select All and the list
    // cover everything — not just the server's first 100.
    queryKey: ['inventory-all', { distributorId: fromDistId }],
    queryFn: () => listAllInventory({ distributorId: fromDistId }),
    enabled: !!fromDistId && mode === 'pick',
  });

  const items = inventoryData ?? [];

  /** Parse the uploaded spreadsheet → server-side preview against source stock. */
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!fromDistId) throw new Error('Pick a source distributor first');
      const barcodes = await parseSpreadsheet(file);
      if (barcodes.length === 0) throw new Error('No barcodes found in file');
      return previewBatchTransfer({ fromDistributorId: fromDistId, barcodes });
    },
    onSuccess: (data) => {
      setBatchLines(data.lines);
      setExcludedIds(new Set());
      const c = countByStatus(data.lines);
      addToast(
        `${c.available} ready · ${c.not_in_stock} not in stock · ${c.error} errors`,
        c.not_in_stock + c.error === 0 ? 'success' : 'error',
      );
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  /** Add one missing item to the source distributor and re-preview to refresh ids. */
  const addOneMissingMutation = useMutation({
    mutationFn: async (line: BatchLine) => {
      if (!line.parsed) throw new Error('Cannot add: missing parsed data');
      if (!fromDistId) throw new Error('Pick a source distributor first');
      await assignItems([line.parsed], fromDistId);
      const barcodes = batchLines.map((l) => l.barcode);
      return previewBatchTransfer({ fromDistributorId: fromDistId, barcodes });
    },
    onSuccess: (data) => {
      setBatchLines(data.lines);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      addToast('Item added to source — now ready to transfer', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  /** Add ALL missing items in one call and re-preview. */
  const addAllMissingMutation = useMutation({
    mutationFn: async () => {
      const missing = batchLines.filter((l) => l.status === 'not_in_stock' && l.parsed);
      if (missing.length === 0) throw new Error('Nothing to add');
      if (!fromDistId) throw new Error('Pick a source distributor first');
      await assignItems(missing.map((l) => l.parsed!), fromDistId);
      const barcodes = batchLines.map((l) => l.barcode);
      return previewBatchTransfer({ fromDistributorId: fromDistId, barcodes });
    },
    onSuccess: (data) => {
      setBatchLines(data.lines);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      addToast('All missing items added to source', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  /**
   * Commit step — moves the chosen items into the destination. Both modes go
   * through this. Excel mode additionally passes expectedFromDistributorId so
   * any item that moved between preview and commit lands in `blockedLines`
   * instead of being silently relocated.
   */
  const transferMutation = useMutation({
    mutationFn: async () => {
      const fromDist = distributors.find((d) => d.id === fromDistId);
      const toDist = distributors.find((d) => d.id === toDistId);

      let toTransfer: ReviewItem[];
      const blocked: BatchLine[] = [];

      if (mode === 'pick') {
        const selected = items.filter((i) => selectedIds.has(i.id));
        for (const item of selected) {
          await reassignItem(item.id, toDistId || null, note || 'Transfer', {
            skipTransferRecord: true,
          });
        }
        toTransfer = selected.map((i) => ({
          id: i.id,
          udi: i.udi,
          itemNumber: i.itemNumber || null,
          productLabel: i.productLabel,
          lot: i.lot,
          gtin: i.gtin,
          expDate: i.expDate,
        }));
      } else {
        const items = buildTransferItems(batchLines, excludedIds);
        const moved: ReviewItem[] = [];
        for (const it of items) {
          try {
            await reassignItem(it.id, toDistId || null, note || 'Batch transfer', {
              skipTransferRecord: true,
              expectedFromDistributorId: fromDistId,
            });
            moved.push(it);
          } catch (err) {
            // Server returns 409 if the item moved since preview — skip & report.
            const msg = err instanceof Error ? err.message : '';
            if (msg.toLowerCase().includes('no longer at') || msg.includes('409')) {
              const line = batchLines.find((l) => l.matchedItemId === it.id);
              if (line) blocked.push(line);
            } else {
              throw err;
            }
          }
        }
        toTransfer = moved;
      }

      if (toTransfer.length === 0) {
        throw new Error('No items were transferred');
      }

      const transfer = await createTransfer({
        fromDistributorId: fromDistId || null,
        fromDistributorName: fromDist?.name || 'Unassigned',
        toDistributorId: toDistId || null,
        toDistributorName: toDist?.name || 'Unassigned',
        note: note || '',
        items: toTransfer,
      });

      return { transfer, blocked };
    },
    onSuccess: ({ transfer, blocked }) => {
      setSavedTransfer(transfer);
      setBlockedLines(blocked);
      setStep('done');
      const blockedNote = blocked.length > 0 ? ` (${blocked.length} skipped — moved since preview)` : '';
      addToast(
        `${transfer.itemCount} items transferred — ${transfer.transferId}${blockedNote}`,
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  function toggleExclude(matchedId: string) {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchedId)) next.delete(matchedId);
      else next.add(matchedId);
      return next;
    });
  }

  function removeBatchLine(barcode: string) {
    setBatchLines((prev) => prev.filter((l) => l.barcode !== barcode));
  }

  function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    previewMutation.mutate(file);
  }

  function resetAll() {
    setStep('select');
    setFromDistId('');
    setToDistId('');
    setNote('');
    setSelectedIds(new Set());
    setSavedTransfer(null);
    setBatchLines([]);
    setExcludedIds(new Set());
    setBlockedLines([]);
  }

  function handlePrint() {
    const original = document.title;
    if (savedTransfer) {
      document.title = `Transfer-${savedTransfer.transferId}`;
    }
    window.print();
    setTimeout(() => { document.title = original; }, 1000);
  }

  const fromDist = distributors.find((d) => d.id === fromDistId);
  const toDist = distributors.find((d) => d.id === toDistId);

  // Confirm step displays both modes through a shared ReviewItem[].
  const reviewItems: ReviewItem[] =
    mode === 'pick'
      ? items
          .filter((i) => selectedIds.has(i.id))
          .map((i) => ({
            id: i.id,
            udi: i.udi,
            itemNumber: i.itemNumber || null,
            productLabel: i.productLabel,
            lot: i.lot,
            gtin: i.gtin,
            expDate: i.expDate,
          }))
      : buildTransferItems(batchLines, excludedIds);

  const batchCounts = countByStatus(batchLines);
  const hasMissing = batchCounts.not_in_stock > 0;
  const includedExcelCount = batchLines.filter((l) => isTransferable(l, excludedIds)).length;
  const canReview =
    (mode === 'pick' && selectedIds.size > 0 && toDistId) ||
    (mode === 'excel' && includedExcelCount > 0 && toDistId);

  return (
    <div className="mx-auto max-w-4xl lg:max-w-7xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="print:hidden">
        <h2 className="mb-4 text-xl font-bold text-gray-900">Transfer Inventory</h2>

        <HelpBanner storageKey="transfer">
          Move multiple items between distributors in one batch. Select a source distributor, choose the items to move, then pick a destination.
        </HelpBanner>

        {/* Mode toggle — only relevant on the select step. */}
        {step === 'select' && (
          <div className="mb-4 inline-flex rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setMode('pick')}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium',
                mode === 'pick' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
              )}
            >
              Pick from list
            </button>
            <button
              onClick={() => setMode('excel')}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium',
                mode === 'excel' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
              )}
            >
              Import from Excel
            </button>
          </div>
        )}

        {/* STEP 1 */}
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
                      setSelectedIds(new Set());
                      setBatchLines([]);
                      setExcludedIds(new Set());
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

            {/* PICK MODE — unchanged item-list flow */}
            {mode === 'pick' && fromDistId && (
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
                          onClick={() => toggleItem(item.id)}
                          className={cn(
                            'rounded-xl bg-white p-3 shadow-sm border-2 cursor-pointer transition-colors',
                            selectedIds.has(item.id) ? 'border-primary-400 bg-primary-50' : 'border-transparent',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2',
                              selectedIds.has(item.id) ? 'border-primary-600 bg-primary-600' : 'border-gray-300',
                            )}>
                              {selectedIds.has(item.id) && <Check size={14} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{item.productLabel || 'Unknown'}</p>
                              <p className="text-xs font-mono text-gray-500 truncate">{item.itemNumber || '—'}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs text-gray-400">LOT: {item.lot}</span>
                                <ExpiryBadge expDate={item.expDate} showDate />
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
                                checked={selectedIds.size === items.length && items.length > 0}
                                onChange={(e) => e.target.checked ? selectAll() : selectNone()}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </th>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3">Item Number</th>
                            <th className="px-4 py-3">LOT</th>
                            <th className="px-4 py-3">Expiry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => toggleItem(item.id)}
                              className={cn(
                                'border-b cursor-pointer transition-colors',
                                selectedIds.has(item.id) ? 'bg-primary-50' : 'hover:bg-gray-50',
                              )}
                            >
                              <td className="px-4 py-3">
                                <input type="checkbox" checked={selectedIds.has(item.id)} readOnly className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                              </td>
                              <td className="px-4 py-3 font-medium">{item.productLabel || 'Unknown'}</td>
                              <td className="px-4 py-3 font-mono">{item.itemNumber || '—'}</td>
                              <td className="px-4 py-3">{item.lot}</td>
                              <td className="px-4 py-3"><ExpiryBadge expDate={item.expDate} showDate /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            {/* EXCEL MODE — upload + per-row preview */}
            {mode === 'excel' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="mb-3 text-sm text-gray-500">
                    Upload a CSV / Excel file with one barcode per row. Each item must
                    already be in the source distributor's inventory; we'll flag any
                    that aren't so you can add them or skip them.
                  </p>
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    disabled={!fromDistId || previewMutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 px-4 py-6 text-base font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                  >
                    <FileSpreadsheet size={22} />
                    {previewMutation.isPending
                      ? 'Reading file…'
                      : batchLines.length > 0
                        ? 'Upload a different file'
                        : 'Choose CSV / Excel file'}
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    onChange={handleCsvImport}
                    className="hidden"
                  />
                  {!fromDistId && (
                    <p className="mt-2 text-xs text-amber-600">Pick a source distributor first.</p>
                  )}
                </div>

                {batchLines.length > 0 && (
                  <>
                    {/* Counters */}
                    <div className="flex flex-wrap gap-2">
                      <Stat label="Ready" count={batchCounts.available} color="green" />
                      <Stat label="Not in stock" count={batchCounts.not_in_stock} color="amber" />
                      <Stat label="Errors" count={batchCounts.error} color="red" />
                    </div>

                    {hasMissing && (
                      <button
                        onClick={() => addAllMissingMutation.mutate()}
                        disabled={addAllMissingMutation.isPending}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <Plus size={18} />
                        {addAllMissingMutation.isPending
                          ? 'Adding…'
                          : `Add all ${batchCounts.not_in_stock} missing items to source & include`}
                      </button>
                    )}

                    {/* Per-row list */}
                    <div className="space-y-2">
                      {batchLines.map((line) => (
                        <BatchRow
                          key={`${line.barcode}-${line.matchedItemId ?? 'x'}`}
                          line={line}
                          excluded={!!line.matchedItemId && excludedIds.has(line.matchedItemId)}
                          onToggle={() => line.matchedItemId && toggleExclude(line.matchedItemId)}
                          onAddMissing={() => addOneMissingMutation.mutate(line)}
                          onRemove={() => removeBatchLine(line.barcode)}
                          addPending={addOneMissingMutation.isPending}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {canReview && (
              <div className="sticky bottom-20 lg:bottom-4 z-30">
                <button
                  onClick={() => setStep('confirm')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-4 text-base font-semibold text-white shadow-lg hover:bg-primary-700 transition-colors"
                >
                  <ArrowRightLeft size={20} />
                  Review Transfer ({mode === 'pick' ? selectedIds.size : includedExcelCount} items)
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
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
                {reviewItems.length} item{reviewItems.length !== 1 ? 's' : ''} to transfer:
              </p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200">
                {reviewItems.map((item, idx) => (
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

        {/* STEP 3 */}
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
            {blockedLines.length > 0 && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">
                  {blockedLines.length} item{blockedLines.length !== 1 ? 's' : ''} skipped — moved out of source between preview and commit:
                </p>
                <ul className="text-xs text-amber-700 list-disc pl-5">
                  {blockedLines.map((l) => (
                    <li key={l.barcode}>{l.productLabel || l.barcode} · LOT {l.lot}</li>
                  ))}
                </ul>
              </div>
            )}
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
                <p className="text-base font-bold">Nail Tracker</p>
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
                {(savedTransfer.items as ReviewItem[]).map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-300">
                    <td className="py-1 pr-1 text-gray-500">{idx + 1}</td>
                    <td className="py-1 px-1">{item.productLabel || 'Unknown'}</td>
                    <td className="py-1 px-1 font-mono">{item.udi}</td>
                    <td className="py-1 px-1">{item.lot}</td>
                    <td className="py-1 px-1 font-mono">{item.gtin}</td>
                    <td className="py-1 pl-1">{formatExpiry(item.expDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-xs text-gray-600">
              Total: <strong>{savedTransfer.itemCount}</strong> items
            </p>

            <p className="fixed bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
              Nail Tracker v{APP_VERSION}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, count, color }: { label: string; count: number; color: 'green' | 'amber' | 'red' }) {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={cn('rounded-full px-3 py-1 text-sm font-medium', colors[color])}>
      {count} {label}
    </span>
  );
}

function BatchRow({
  line,
  excluded,
  onToggle,
  onAddMissing,
  onRemove,
  addPending,
}: {
  line: BatchLine;
  excluded: boolean;
  onToggle: () => void;
  onAddMissing: () => void;
  onRemove: () => void;
  addPending: boolean;
}) {
  const isAvailable = line.status === 'available';
  const isMissing = line.status === 'not_in_stock';
  const isError = line.status === 'error';

  return (
    <div
      className={cn(
        'rounded-xl p-3 shadow-sm border-2 transition-colors',
        isAvailable && !excluded && 'border-green-300 bg-green-50',
        isAvailable && excluded && 'border-gray-200 bg-white',
        isMissing && 'border-amber-300 bg-amber-50',
        isError && 'border-red-300 bg-red-50',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {isAvailable && (
            <CheckCircle2
              size={20}
              className={excluded ? 'text-gray-300' : 'text-green-600'}
            />
          )}
          {isMissing && <AlertTriangle size={20} className="text-amber-500" />}
          {isError && <XCircle size={20} className="text-red-500" />}
        </div>
        <div className="flex-1 min-w-0">
          {isError ? (
            <>
              <p className="text-sm font-medium text-red-700">Could not read barcode</p>
              <p className="text-xs text-red-600">{line.errorMessage}</p>
              <p className="text-xs font-mono text-gray-400 truncate">{line.barcode}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {line.productLabel || 'Unknown'}
              </p>
              <p className="text-xs font-mono text-gray-500 truncate">{line.itemNumber || '—'}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-gray-500">LOT: {line.lot}</span>
                {line.expDate && <ExpiryBadge expDate={line.expDate} showDate />}
              </div>
              {isMissing && (
                <p className="mt-1 text-xs text-amber-700">
                  Not in source distributor's inventory
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {isAvailable && (
            <button
              onClick={onToggle}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
            >
              {excluded ? 'Include' : 'Skip'}
            </button>
          )}
          {isMissing && (
            <>
              <button
                onClick={onAddMissing}
                disabled={addPending}
                className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Add to source
              </button>
              <button
                onClick={onRemove}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50"
              >
                Skip
              </button>
            </>
          )}
          {isError && (
            <button
              onClick={onRemove}
              className="rounded-lg p-1 text-gray-300 hover:text-red-500"
              title="Remove"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
