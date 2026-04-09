import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  Keyboard,
} from 'lucide-react';
import { scanBarcode, assignItems, reassignItem, markAsUsed } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import type { InventoryItem, ParsedItemWithStatus } from '../types';

type ScanResult = {
  parsed: ParsedItemWithStatus;
  existing: InventoryItem | null;
  imageData: string | null;
};

export default function Scan() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [distributorId, setDistributorId] = useState('');
  const [transferDistId, setTransferDistId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const scanMutation = useMutation({
    mutationFn: (params: { barcode: string; imageData?: string }) => scanBarcode(params),
    onSuccess: (data) => {
      setResult({
        parsed: data.parsed,
        existing: data.existing,
        imageData: capturedImage,
      });
      if (data.existing) {
        setTransferDistId(data.existing.distributorId || '');
        addToast('Item found in system', 'success');
      } else if (data.parsed.status === 'new') {
        addToast('New item detected', 'success');
      } else if (data.parsed.status === 'error') {
        addToast('Could not parse barcode', 'error');
      }
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const assignMutation = useMutation({
    mutationFn: () => {
      if (!result || !result.parsed || result.parsed.status !== 'new') {
        throw new Error('No valid item to assign');
      }
      return assignItems([result.parsed], distributorId || null, result.imageData || undefined);
    },
    onSuccess: (data) => {
      addToast(`${data.created} item assigned successfully`, 'success');
      resetState();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const reassignMutation = useMutation({
    mutationFn: () => {
      if (!result?.existing) throw new Error('No item to transfer');
      return reassignItem(result.existing.udi, transferDistId || null, transferNote || undefined);
    },
    onSuccess: () => {
      addToast('Item transferred successfully', 'success');
      resetState();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const useMutation_ = useMutation({
    mutationFn: () => {
      if (!result?.existing) throw new Error('No item to mark');
      return markAsUsed(result.existing.udi);
    },
    onSuccess: () => {
      addToast('Item marked as used', 'success');
      resetState();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  function resetState() {
    setResult(null);
    setDistributorId('');
    setTransferDistId('');
    setTransferNote('');
    setShowManualEntry(false);
    setManualBarcode('');
    setCapturedImage(null);
  }

  function handleBarcodeDetected(barcode: string, imageDataUrl: string) {
    setCapturedImage(imageDataUrl);
    scanMutation.mutate({ barcode, imageData: imageDataUrl });
  }

  function handleManualSubmit() {
    const trimmed = manualBarcode.trim();
    if (!trimmed) {
      addToast('Please enter a barcode', 'error');
      return;
    }
    scanMutation.mutate({ barcode: trimmed, imageData: capturedImage || undefined });
  }

  function handleScanError(message: string) {
    setShowManualEntry(true);
    addToast(message, 'error');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Hidden div for html5-qrcode */}
      <div id="barcode-scanner-hidden" className="hidden" />

      <h2 className="mb-4 text-xl font-bold text-gray-900">Scan Item</h2>

      {/* No result yet — show scanner */}
      {!result && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-3 text-base text-gray-600">
              Take a photo or upload an image of the barcode label
            </p>
            <BarcodeScanner onResult={handleBarcodeDetected} onError={handleScanError} />
          </div>

          {/* Manual entry fallback */}
          {showManualEntry && (
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-gray-700">
                <Keyboard size={20} />
                <span className="text-sm font-medium">Enter barcode manually</span>
              </div>
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="(01)08880089459148(10)J250929-L021(17)300928"
                className="mb-3 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
              />
              <button
                onClick={handleManualSubmit}
                disabled={scanMutation.isPending || !manualBarcode.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <ScanLine size={20} />
                {scanMutation.isPending ? 'Processing...' : 'Submit Barcode'}
              </button>
            </div>
          )}

          {/* Toggle manual entry if not showing */}
          {!showManualEntry && (
            <button
              onClick={() => setShowManualEntry(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-600 hover:bg-gray-50"
            >
              <Keyboard size={20} />
              Enter barcode manually
            </button>
          )}
        </div>
      )}

      {/* Result — NEW item */}
      {result && !result.existing && result.parsed.status === 'new' && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-green-700">
              <CheckCircle2 size={22} />
              <span className="text-lg font-semibold">New Item Detected</span>
            </div>

            {/* Show captured image thumbnail */}
            {result.imageData && (
              <img
                src={result.imageData}
                alt="Scanned barcode"
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}

            <div className="space-y-1">
              <p className="text-lg font-bold text-gray-900">{result.parsed.productLabel}</p>
              <p className="text-sm font-mono text-gray-600">{result.parsed.udi}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">LOT: {result.parsed.lot}</span>
                <ExpiryBadge
                  expDate={result.parsed.expDate ? new Date(result.parsed.expDate).toISOString() : null}
                />
              </div>
            </div>
          </div>

          {/* Assign to distributor */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">
                Assign to distributor
              </span>
              <select
                value={distributorId}
                onChange={(e) => setDistributorId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none bg-white"
              >
                <option value="">Unassigned</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Package size={20} />
              {assignMutation.isPending ? 'Assigning...' : 'Add to Inventory'}
            </button>
          </div>

          <button
            onClick={resetState}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50"
          >
            Scan Another Item
          </button>
        </div>
      )}

      {/* Result — EXISTING item */}
      {result?.existing && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-blue-700">
              <AlertTriangle size={22} />
              <span className="text-lg font-semibold">Item Already in System</span>
            </div>

            {/* Show captured image thumbnail */}
            {result.imageData && (
              <img
                src={result.imageData}
                alt="Scanned barcode"
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}

            <div className="space-y-1">
              <p className="text-lg font-bold text-gray-900">
                {result.existing.productLabel || 'Unknown Product'}
              </p>
              <p className="text-sm font-mono text-gray-600">{result.existing.udi}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">LOT: {result.existing.lot}</span>
                <ExpiryBadge expDate={result.existing.expDate} />
              </div>
              <p className="mt-2 text-base text-gray-700">
                Currently with:{' '}
                <span className="font-semibold">
                  {result.existing.distributor?.name || 'Unassigned'}
                </span>
              </p>
            </div>
          </div>

          {/* Transfer */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Transfer to Another Distributor</h3>
            <label className="block mb-2">
              <span className="text-sm font-medium text-gray-700">New Distributor</span>
              <select
                value={transferDistId}
                onChange={(e) => setTransferDistId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none bg-white"
              >
                <option value="">Unassigned</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">Note (optional)</span>
              <input
                type="text"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Reason for transfer"
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
              />
            </label>
            <button
              onClick={() => reassignMutation.mutate()}
              disabled={reassignMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <ArrowRightLeft size={20} />
              {reassignMutation.isPending ? 'Transferring...' : 'Transfer Item'}
            </button>
          </div>

          {/* Mark as Used */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <button
              onClick={() => {
                if (confirm('Mark this item as used? This indicates the implant has been used in a procedure.')) {
                  useMutation_.mutate();
                }
              }}
              disabled={useMutation_.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-base font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 size={20} />
              {useMutation_.isPending ? 'Marking...' : 'Mark as Used (Implanted)'}
            </button>
          </div>

          <button
            onClick={resetState}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50"
          >
            Scan Another Item
          </button>
        </div>
      )}

      {/* Result — PARSE ERROR */}
      {result && result.parsed.status === 'error' && !result.existing && (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4">
            <p className="text-base font-semibold text-red-700">Could not parse barcode</p>
            <p className="mt-1 text-sm text-red-600">{(result.parsed as any).errorMessage || 'Unknown error'}</p>
          </div>
          <button
            onClick={resetState}
            className="w-full rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
