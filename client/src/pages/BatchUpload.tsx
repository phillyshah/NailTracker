import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  Images,
  Trash2,
} from 'lucide-react';
import { scanBarcode, assignItems } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { compressImage } from '../utils/compressImage';
import { detectBarcodesFromImage } from '../utils/barcodeDetector';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { ToastContainer } from '../components/Toast';
import { HelpBanner } from '../components/HelpBanner';
import { useToast } from '../hooks/useToast';

interface BatchItem {
  id: number;
  imageData: string;
  barcode: string | null;
  parsed: any | null;
  existing: any | null;
  status: 'processing' | 'new' | 'duplicate' | 'error';
  error?: string;
  selected: boolean;
}

let nextId = 0;

export default function BatchUpload() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [distributorId, setDistributorId] = useState('');
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  // Find Home Office distributor and default to it
  const homeOffice = distributors.find(
    (d) => d.name === 'Home Office' || d.name === 'Home Office (HQ)',
  );

  const assignMutation = useMutation({
    mutationFn: () => {
      const selected = items
        .filter((i) => i.selected && i.status === 'new' && i.parsed)
        .map((i) => ({
          ...i.parsed,
          imageData: i.imageData,
        }));
      if (selected.length === 0) throw new Error('No items selected');
      return assignItems(selected, distributorId || null);
    },
    onSuccess: (data) => {
      addToast(`${data.created} items added to inventory`, 'success');
      setItems([]);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setProcessing(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      // Skip header row if it looks like one
      const startIdx = lines[0]?.match(/^(barcode|gtin|udi|code)/i) ? 1 : 0;
      const barcodes: string[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        // Take the first non-empty column from each CSV row
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
        const barcode = cols[0];
        if (barcode && barcode.length > 5) barcodes.push(barcode);
      }

      if (barcodes.length === 0) {
        addToast('No barcodes found in file', 'error');
        setProcessing(false);
        return;
      }

      // Create placeholder items
      const placeholders: BatchItem[] = barcodes.map((b) => ({
        id: nextId++,
        imageData: '',
        barcode: b,
        parsed: null,
        existing: null,
        status: 'processing' as const,
        selected: true,
      }));
      setItems((prev) => [...prev, ...placeholders]);

      // Process each barcode against the server
      for (const ph of placeholders) {
        try {
          const result = await scanBarcode({ barcode: ph.barcode! });
          setItems((prev) =>
            prev.map((item) =>
              item.id === ph.id
                ? {
                    ...item,
                    parsed: result.parsed,
                    existing: result.existing,
                    status: result.existing ? 'duplicate' : result.parsed.status === 'error' ? 'error' : 'new',
                    error: result.parsed.status === 'error' ? result.parsed.errorMessage : undefined,
                    selected: !result.existing && result.parsed.status !== 'error',
                  }
                : item,
            ),
          );
        } catch {
          setItems((prev) =>
            prev.map((item) =>
              item.id === ph.id
                ? { ...item, status: 'error', error: 'Server error', selected: false }
                : item,
            ),
          );
        }
      }

      addToast(`Processed ${barcodes.length} barcodes from file`, 'success');
    } catch {
      addToast('Failed to read file', 'error');
    }

    setProcessing(false);
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    setProcessing(true);

    const newItems: BatchItem[] = [];
    for (const file of files) {
      const id = nextId++;
      const item: BatchItem = {
        id,
        imageData: '',
        barcode: null,
        parsed: null,
        existing: null,
        status: 'processing',
        selected: true,
      };
      newItems.push(item);
    }

    setItems((prev) => [...prev, ...newItems]);

    // Process each file — each image may contain up to 4 barcodes
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const itemId = newItems[i].id;

      try {
        const compressed = await compressImage(file);
        const barcodes = await detectBarcodesFromImage(file);

        if (barcodes.length > 0) {
          // Update the original placeholder with the first barcode
          const firstBarcode = barcodes[0];
          try {
            const result = await scanBarcode({ barcode: firstBarcode, imageData: compressed });
            setItems((prev) =>
              prev.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      imageData: compressed,
                      barcode: firstBarcode,
                      parsed: result.parsed,
                      existing: result.existing,
                      status: result.existing ? 'duplicate' : result.parsed.status === 'error' ? 'error' : 'new',
                      error: result.parsed.status === 'error' ? result.parsed.errorMessage : undefined,
                      selected: !result.existing && result.parsed.status !== 'error',
                    }
                  : item,
              ),
            );
          } catch {
            setItems((prev) =>
              prev.map((item) =>
                item.id === itemId
                  ? { ...item, imageData: compressed, barcode: firstBarcode, status: 'error', error: 'Server error', selected: false }
                  : item,
              ),
            );
          }

          // Additional barcodes from the same image — add as new items
          for (let j = 1; j < barcodes.length; j++) {
            const extraId = nextId++;
            try {
              const result = await scanBarcode({ barcode: barcodes[j], imageData: compressed });
              setItems((prev) => [
                ...prev,
                {
                  id: extraId,
                  imageData: compressed,
                  barcode: barcodes[j],
                  parsed: result.parsed,
                  existing: result.existing,
                  status: result.existing ? 'duplicate' : result.parsed.status === 'error' ? 'error' : 'new',
                  error: result.parsed.status === 'error' ? result.parsed.errorMessage : undefined,
                  selected: !result.existing && result.parsed.status !== 'error',
                },
              ]);
            } catch {
              setItems((prev) => [
                ...prev,
                { id: extraId, imageData: compressed, barcode: barcodes[j], parsed: null, existing: null, status: 'error', error: 'Server error', selected: false },
              ]);
            }
          }
        } else {
          // No barcode detected
          setItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    imageData: compressed,
                    status: 'error',
                    error: 'No barcode detected in image',
                    selected: false,
                  }
                : item,
            ),
          );
        }
      } catch {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, status: 'error', error: 'Failed to process image', selected: false }
              : item,
          ),
        );
      }
    }

    setProcessing(false);

    const processed = newItems.length;
    addToast(`Processed ${processed} image${processed !== 1 ? 's' : ''}`, 'success');
  }

  function toggleSelect(id: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.status === 'new' ? { ...item, selected: !item.selected } : item,
      ),
    );
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  const newItems = items.filter((i) => i.selected && i.status === 'new');
  const stats = {
    total: items.length,
    new: items.filter((i) => i.status === 'new').length,
    duplicate: items.filter((i) => i.status === 'duplicate').length,
    error: items.filter((i) => i.status === 'error').length,
    processing: items.filter((i) => i.status === 'processing').length,
  };

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <h2 className="mb-4 text-xl font-bold text-gray-900">Batch Upload</h2>

      <HelpBanner storageKey="batch">
        Upload barcode photos (each photo can contain up to 4 barcodes) or import a CSV/Excel file with barcode data.
      </HelpBanner>

      {/* Upload area */}
      <div className="rounded-2xl bg-white p-4 shadow-sm mb-4">
        <p className="mb-3 text-base text-gray-600">
          Upload photos or import a spreadsheet with barcode data
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={processing}
          className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50 px-4 py-10 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50"
        >
          {processing ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
              <span className="text-base font-semibold">Processing images...</span>
            </>
          ) : (
            <>
              <Images size={36} />
              <span className="text-base font-semibold">
                {items.length > 0 ? 'Add More Photos' : 'Select Photos'}
              </span>
              <span className="text-sm text-primary-500">
                Tap to select multiple images from your gallery
              </span>
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          className="hidden"
        />

        {/* CSV/Excel upload */}
        <button
          onClick={() => csvInputRef.current?.click()}
          disabled={processing}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <FileSpreadsheet size={20} />
          Import CSV / Excel File
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          onChange={handleCsvUpload}
          className="hidden"
        />
      </div>

      {/* Stats bar */}
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <StatBadge label="Total" count={stats.total} color="gray" />
          <StatBadge label="New" count={stats.new} color="green" />
          <StatBadge label="Duplicate" count={stats.duplicate} color="amber" />
          <StatBadge label="Error" count={stats.error} color="red" />
          {stats.processing > 0 && (
            <StatBadge label="Processing" count={stats.processing} color="blue" />
          )}
        </div>
      )}

      {/* Results */}
      {items.length > 0 && (
        <div className="space-y-2 mb-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleSelect(item.id)}
              className={`rounded-2xl bg-white p-3 shadow-sm border-2 transition-colors ${
                item.status === 'processing'
                  ? 'border-blue-200 bg-blue-50'
                  : item.status === 'error'
                    ? 'border-red-200 bg-red-50'
                    : item.status === 'duplicate'
                      ? 'border-amber-200 bg-amber-50'
                      : item.selected
                        ? 'border-primary-400 bg-primary-50 cursor-pointer'
                        : 'border-gray-200 cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                {item.imageData && (
                  <img
                    src={item.imageData}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover shrink-0"
                  />
                )}

                {/* Status icon */}
                <div className="mt-1 shrink-0">
                  {item.status === 'processing' && (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                  )}
                  {item.status === 'new' && (
                    <CheckCircle2
                      size={20}
                      className={item.selected ? 'text-primary-600' : 'text-gray-300'}
                    />
                  )}
                  {item.status === 'duplicate' && (
                    <AlertTriangle size={20} className="text-amber-500" />
                  )}
                  {item.status === 'error' && (
                    <XCircle size={20} className="text-red-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {item.status === 'processing' && (
                    <p className="text-sm text-blue-600">Detecting barcode...</p>
                  )}
                  {item.status === 'error' && (
                    <>
                      <p className="text-sm font-medium text-red-700">Error</p>
                      <p className="text-xs text-red-500">{item.error}</p>
                    </>
                  )}
                  {item.status === 'duplicate' && item.existing && (
                    <>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.existing.productLabel || 'Unknown'}
                      </p>
                      <p className="text-xs font-mono text-gray-500">{item.existing.udi}</p>
                      <span className="inline-block mt-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Already in system
                      </span>
                    </>
                  )}
                  {item.status === 'new' && item.parsed && (
                    <>
                      <p className="text-sm font-semibold text-gray-900">
                        {item.parsed.productLabel}
                      </p>
                      <p className="text-xs font-mono text-gray-500">{item.parsed.udi}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-400">LOT: {item.parsed.lot}</span>
                        <ExpiryBadge
                          expDate={
                            item.parsed.expDate
                              ? new Date(item.parsed.expDate).toISOString()
                              : null
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.id);
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign section */}
      {newItems.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <label className="block mb-3">
            <span className="text-sm font-medium text-gray-700">
              Assign {newItems.length} item{newItems.length !== 1 ? 's' : ''} to
            </span>
            <select
              value={distributorId}
              onChange={(e) => setDistributorId(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none bg-white"
            >
              <option value="">Unassigned</option>
              {/* Home Office first */}
              {homeOffice && (
                <option key={homeOffice.id} value={homeOffice.id}>
                  {homeOffice.name}
                </option>
              )}
              {distributors
                .filter((d) => d.id !== homeOffice?.id)
                .map((d) => (
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
              : `Add ${newItems.length} Item${newItems.length !== 1 ? 's' : ''} to Inventory`}
          </button>
        </div>
      )}
    </div>
  );
}

function StatBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${colors[color]}`}>
      {count} {label}
    </span>
  );
}

