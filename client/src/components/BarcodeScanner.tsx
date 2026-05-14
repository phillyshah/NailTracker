import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, RotateCcw, ScanLine } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { compressImage } from '../utils/compressImage';
import { detectBarcodesFromImage } from '../utils/barcodeDetector';

const LIVE_SCANNER_ID = 'live-barcode-viewfinder';

interface BarcodeScannerProps {
  onResult: (barcode: string, imageDataUrl: string) => void;
  onError?: (message: string) => void;
}

export function BarcodeScanner({ onResult, onError }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'idle' | 'live' | 'camera' | 'processing'>('idle');
  const [statusText, setStatusText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const stopLiveScan = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setMode('idle');
  }, []);

  // Stop live scan on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  async function startLiveScan() {
    setCameraError(null);
    setMode('live');

    // Yield to let React render the container div before html5-qrcode touches it
    await new Promise((r) => setTimeout(r, 50));

    const scanner = new Html5Qrcode(LIVE_SCANNER_ID);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          // Wide rectangle suits Code 128 / GS1-128 linear barcodes better than a square
          qrbox: { width: 280, height: 80 },
          aspectRatio: 1.7778,
        },
        (decodedText) => {
          stopLiveScan();
          onResult(decodedText, '');
        },
        () => {
          // Called on every unrecognised frame — not an error
        },
      );
    } catch {
      scannerRef.current = null;
      setMode('idle');
      setCameraError('Camera not available. Use "Take Photo" instead.');
    }
  }


  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processImage(file);
  }

  async function processImage(blob: Blob | File) {
    setMode('processing');
    setStatusText('Detecting barcode...');
    try {
      const compressed = await compressImage(blob);
      setPreview(compressed);

      // Detect up to 4 barcodes from a single image
      const barcodes = await detectBarcodesFromImage(blob);
      if (barcodes.length > 0) {
        for (const barcode of barcodes) {
          onResult(barcode, compressed);
        }
        setPreview(null);
        setMode('idle');
        setStatusText('');
        return;
      }

      // All methods failed — show manual entry fallback
      setMode('idle');
      setStatusText('');
      onError?.('Could not read barcode or label text. You can enter it manually below.');
    } catch (err) {
      console.error('[BarcodeScanner] Processing error:', err);
      setMode('idle');
      setStatusText('');
      onError?.('Failed to process image. Please try again.');
    }
  }

  function reset() {
    setPreview(null);
    setCameraError(null);
    setStatusText('');
    setMode('idle');
  }

  return (
    <div className="space-y-3">
      {/* Hidden element for html5-qrcode still-image scanning */}
      <div id="barcode-scanner-hidden" className="hidden" />

      {/* Live camera viewfinder */}
      {mode === 'live' && (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <div id={LIVE_SCANNER_ID} className="w-full" />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <button
              onClick={stopLiveScan}
              className="flex items-center gap-2 rounded-full bg-black/60 px-5 py-2.5 text-sm font-medium text-white backdrop-blur hover:bg-black/80"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview image */}
      {preview && mode !== 'processing' && (
        <div className="relative overflow-hidden rounded-2xl">
          <img src={preview} alt="Captured" className="w-full rounded-2xl" />
          <button
            onClick={reset}
            className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Processing spinner */}
      {mode === 'processing' && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gray-100 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-3 text-base text-gray-600">{statusText || 'Processing...'}</p>
        </div>
      )}

      {/* Action buttons */}
      {mode === 'idle' && !preview && (
        <div className="space-y-3">
          {/* Live Scan — continuous camera stream */}
          <button
            onClick={startLiveScan}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary-400 bg-primary-600 px-4 py-5 text-white hover:bg-primary-700 transition-colors"
          >
            <ScanLine size={28} />
            <span className="text-lg font-semibold">Live Scan</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            {/* Take Photo — opens native camera */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50 px-4 py-8 text-primary-700 hover:bg-primary-100 transition-colors"
            >
              <Camera size={32} />
              <span className="text-base font-semibold">Take Photo</span>
            </button>
            {/* Upload Photo — opens photo gallery */}
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Upload size={32} />
              <span className="text-base font-semibold">Upload Photo</span>
            </button>
          </div>

          {/* Camera input — has capture attribute to open camera */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Upload input — NO capture attribute, opens gallery/file picker */}
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Retry after failed detection */}
      {preview && mode === 'idle' && (
        <button
          onClick={reset}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-100"
        >
          <RotateCcw size={20} />
          Try Again
        </button>
      )}

      {/* Camera error */}
      {cameraError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          {cameraError}
        </div>
      )}
    </div>
  );
}
