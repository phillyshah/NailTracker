import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  Plus,
  Images,
  X,
} from 'lucide-react';
import { scanBarcode, assignItems } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { compressImage } from '../utils/compressImage';
import { detectBarcodesFromImage } from '../utils/barcodeDetector';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { HelpBanner } from '../components/HelpBanner';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

interface ReceivedItem {
  id: number;
  parsed: any;
  imageData: string | null;
  status: 'new' | 'duplicate' | 'error';
  error?: string;
}

let nextId = 0;

export default function Receive() {
  const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
  const [scanning, setScanning] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const homeOffice = distributors.find(
    (d) => d.name === 'Home Office' || d.name === 'Home Office (HQ)',
  );

  const scanMutation = useMutation({
    mutationFn: (params: { barcode: string; imageData?: string }) => scanBarcode(params),
  });

  async function handleBarcode(barcode: string, imageData: string) {
    try {
      const result = await scanMutation.mutateAsync({ barcode, imageData });

      if (result.parsed.status === 'error') {
        addToast(result.parsed.errorMessage || 'Could not parse barcode', 'error');
        setScanning(true);
        return;
      }

      if (result.existing) {
        setReceivedItems((prev) => [
          { id: nextId++, parsed: result.parsed, imageData, status: 'duplicate' },
          ...prev,
        ]);
        addToast('Item already in system', 'error');
        setScanning(true);
        return;
      }

      // Auto-receive new items directly to Home Office
      if (homeOffice) {
        try {
          const itemData = { ...result.parsed, imageData };
          const assignResult = await assignItems([itemData], homeOffice.id);
          if (assignResult.created > 0) {
            setReceivedItems((prev) => [
              { id: nextId++, parsed: result.parsed, imageData, status: 'new' },
              ...prev,
            ]);
            addToast(`Received: ${result.parsed.productLabel}`, 'success');
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
          } else {
            addToast('Item was skipped (may already exist)', 'error');
          }
        } catch {
          addToast('Failed to save item', 'error');
        }
      } else {
        setReceivedItems((prev) => [
          { id: nextId++, parsed: result.parsed, imageData, status: 'new' },
          ...prev,
        ]);
        addToast('Scanned — set up Home Office distributor to auto-receive', 'error');
      }
    } catch {
      addToast('Failed to process barcode', 'error');
    }
    setScanning(true);
  }

  async function handleManualSubmit() {
    const trimmed = manualBarcode.trim();
    if (!trimmed) return;
    setManualBarcode('');
    await handleBarcode(trimmed, '');
  }

  async function handleBatchFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        const barcodes = await detectBarcodesFromImage(file);
        if (barcodes.length > 0) {
          for (const barcode of barcodes) {
            await handleBarcode(barcode, compressed);
          }
        } else {
          setReceivedItems((prev) => [
            {
              id: nextId++,
              parsed: null,
              imageData: compressed,
              status: 'error',
              error: 'No barcode detected',
            },
            ...prev,
          ]);
        }
      } catch {
        // skip failed files
      }
    }
  }

  function handleScanError() {
    setShowManual(true);
  }

  function removeItem(id: number) {
    setReceivedItems((prev) => prev.filter((i) => i.id !== id));
  }

  const newCount = receivedItems.filter((i) => i.status === 'new').length;

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
          <Building2 size={22} className="text-primary-700" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Receive Inventory</h2>
          <p className="text-sm text-gray-500">Scan items into Home Office</p>
        </div>
      </div>

      <HelpBanner storageKey="receive">
        Scan or photograph barcode labels to add new items to Home Office inventory. Items are saved automatically when scanned.
      </HelpBanner>

      {/* Quick scan area — always visible for rapid receiving */}
      {scanning && (
        <div className="rounded-2xl bg-white p-4 shadow-sm mb-4">
          <p className="mb-3 text-sm text-gray-500">
            Scan items one by one, or upload multiple photos
          </p>
          <BarcodeScanner
            onResult={(barcode, imageData) => {
              setScanning(false);
              handleBarcode(barcode, imageData);
            }}
            onError={handleScanError}
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <Images size={18} />
              Batch Upload
            </button>
            <button
              onClick={() => setShowManual(!showManual)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Manual Entry
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleBatchFiles}
            className="hidden"
          />

          {showManual && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="(01)08880089459148(10)..."
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono focus:border-primary-500 focus:outline-none"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualBarcode.trim()}
                className="rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Received items list */}
      {receivedItems.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">
              Received Items ({receivedItems.length})
            </h3>
            {newCount > 0 && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                {newCount} saved
              </span>
            )}
          </div>

          <div className="space-y-2 mb-4">
            {receivedItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl p-3 shadow-sm border ${
                  item.status === 'new'
                    ? 'bg-green-50 border-green-200'
                    : item.status === 'duplicate'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.imageData && (
                    <img src={item.imageData} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {item.status === 'new' && item.parsed && (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.parsed.productLabel}
                          </p>
                        </div>
                        <p className="text-xs font-mono text-gray-500 truncate">{item.parsed.udi}</p>
                      </>
                    )}
                    {item.status === 'duplicate' && (
                      <p className="text-sm text-amber-700">Already in system</p>
                    )}
                    {item.status === 'error' && (
                      <p className="text-sm text-red-700">{item.error}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 p-1 text-gray-300 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </>
      )}

      {/* Empty state */}
      {receivedItems.length === 0 && !scanning && (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-base text-gray-500">No items scanned yet</p>
          <button
            onClick={() => setScanning(true)}
            className="mt-4 flex mx-auto items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-base font-semibold text-white hover:bg-primary-700"
          >
            <Plus size={20} /> Start Scanning
          </button>
        </div>
      )}
    </div>
  );
}

