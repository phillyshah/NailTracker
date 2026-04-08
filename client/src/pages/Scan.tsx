import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScanLine, Check, AlertTriangle, XCircle, Package } from 'lucide-react';
import { parseBarcodes, assignItems } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { cn } from '../utils/cn';
import type { ParsedItemWithStatus } from '../types';

export default function Scan() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<(ParsedItemWithStatus & { selected?: boolean })[]>([]);
  const [distributorId, setDistributorId] = useState('');
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const parseMutation = useMutation({
    mutationFn: (barcodes: string[]) => parseBarcodes(barcodes),
    onSuccess: (data) => {
      setResults(data.map((r: any) => ({ ...r, selected: r.status === 'new' })));
      const newCount = data.filter((r: any) => r.status === 'new').length;
      const dupCount = data.filter((r: any) => r.status === 'duplicate').length;
      const errCount = data.filter((r: any) => r.status === 'error').length;
      addToast(
        `Parsed: ${newCount} new, ${dupCount} duplicate, ${errCount} error`,
        errCount > 0 ? 'error' : 'success',
      );
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const assignMutation = useMutation({
    mutationFn: () => {
      const selected = results.filter((r) => r.selected && r.status === 'new');
      return assignItems(selected, distributorId || null);
    },
    onSuccess: (data) => {
      addToast(`${data.created} items assigned successfully`, 'success');
      setResults([]);
      setInput('');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  function handleParse() {
    const barcodes = input
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (barcodes.length === 0) {
      addToast('Please enter at least one barcode', 'error');
      return;
    }
    parseMutation.mutate(barcodes);
  }

  function toggleSelect(idx: number) {
    setResults((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)),
    );
  }

  const newItems = results.filter((r) => r.selected && r.status === 'new');

  return (
    <div className="mx-auto max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <h2 className="mb-4 text-xl font-bold text-gray-900">Scan & Assign</h2>

      {/* Input area */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">
            Paste barcode(s) — one per line
          </span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            placeholder="(01)08880089459148(10)J250929-L021(17)300928"
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
          />
        </label>
        <button
          onClick={handleParse}
          disabled={parseMutation.isPending || !input.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <ScanLine size={20} />
          {parseMutation.isPending ? 'Parsing...' : 'Parse Barcodes'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">
            Results ({results.length} items)
          </h3>

          {results.map((item, idx) => (
            <div
              key={idx}
              onClick={() => item.status === 'new' && toggleSelect(idx)}
              className={cn(
                'rounded-2xl border-2 bg-white p-4 shadow-sm transition-colors',
                item.status === 'error' && 'border-red-300 bg-red-50',
                item.status === 'duplicate' && 'border-amber-300 bg-amber-50',
                item.status === 'new' && item.selected && 'border-primary-400 bg-primary-50',
                item.status === 'new' && !item.selected && 'border-gray-200',
                item.status === 'new' && 'cursor-pointer',
              )}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {item.status === 'new' && (
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full border-2',
                        item.selected
                          ? 'border-primary-600 bg-primary-600'
                          : 'border-gray-300',
                      )}
                    >
                      {item.selected && <Check size={14} className="text-white" />}
                    </div>
                  )}
                  {item.status === 'duplicate' && (
                    <AlertTriangle size={22} className="text-amber-500" />
                  )}
                  {item.status === 'error' && (
                    <XCircle size={22} className="text-red-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {item.status === 'error' ? (
                    <>
                      <p className="text-base font-medium text-red-700">Parse Error</p>
                      <p className="text-sm text-red-600">{(item as any).error}</p>
                      <p className="mt-1 truncate text-xs text-gray-500 font-mono">
                        {(item as any).rawBarcode}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base font-semibold text-gray-900">
                        {item.productLabel}
                      </p>
                      <p className="text-sm text-gray-600 font-mono">{item.udi}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-500">LOT: {item.lot}</span>
                        <ExpiryBadge expDate={item.expDate ? new Date(item.expDate).toISOString() : null} />
                        {item.status === 'duplicate' && (
                          <span className="rounded-full bg-amber-200 px-3 py-0.5 text-xs font-semibold text-amber-800">
                            Already in system
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Assign section */}
          {newItems.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <label className="block mb-3">
                <span className="text-sm font-medium text-gray-700">
                  Assign to distributor (optional)
                </span>
                <select
                  value={distributorId}
                  onChange={(e) => setDistributorId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none bg-white"
                >
                  <option value="">Unassigned</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Package size={20} />
                {assignMutation.isPending
                  ? 'Assigning...'
                  : `Assign ${newItems.length} Item${newItems.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
