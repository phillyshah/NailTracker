import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, RotateCcw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { compressImage } from '../utils/compressImage';
import { extractBarcodeText } from '../utils/ocrBarcode';

interface BarcodeScannerProps {
  onResult: (barcode: string, imageDataUrl: string) => void;
  onError?: (message: string) => void;
}

export function BarcodeScanner({ onResult, onError }: BarcodeScannerProps) {
  const [mode, setMode] = useState<'idle' | 'camera' | 'processing'>('idle');
  const [statusText, setStatusText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setMode('idle');
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processImage(file);
  }

  async function processImage(blob: Blob | File) {
    setMode('processing');
    setStatusText('Scanning barcode...');
    try {
      const compressed = await compressImage(blob);
      setPreview(compressed);

      // Step 1: Try barcode detection on the original high-res image
      const barcode = await detectBarcode(blob);
      if (barcode) {
        onResult(barcode, compressed);
        setPreview(null);
        setMode('idle');
        setStatusText('');
        return;
      }

      // Step 2: Try OCR to read the text next to the barcode
      setStatusText('Reading label text...');
      const ocrResult = await extractBarcodeText(blob);
      if (ocrResult) {
        onResult(ocrResult, compressed);
        setPreview(null);
        setMode('idle');
        setStatusText('');
        return;
      }

      // Neither worked — show manual entry fallback
      setMode('idle');
      setStatusText('');
      onError?.('Could not read barcode or label text. You can enter it manually below.');
    } catch {
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

/**
 * Try to detect a barcode from an image blob using html5-qrcode.
 */
async function detectBarcode(blob: Blob): Promise<string | null> {
  const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' });
  const scanner = new Html5Qrcode('barcode-scanner-hidden');

  try {
    const result = await scanner.scanFile(file, false);
    return result || null;
  } catch {
    return null;
  } finally {
    try {
      await scanner.clear();
    } catch {
      // ignore
    }
  }
}
