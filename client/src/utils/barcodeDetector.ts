import { Html5Qrcode } from 'html5-qrcode';
import { extractBarcodeText } from './ocrBarcode';

/**
 * BarcodeDetector browser API type declarations.
 * Supported: Chrome Android 83+, Safari iOS 15.4+, Desktop Chrome/Edge.
 */
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorOptions {
  formats: string[];
}

declare class BarcodeDetectorAPI {
  constructor(options?: BarcodeDetectorOptions);
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
  static getSupportedFormats(): Promise<string[]>;
}

/**
 * Detect ALL barcodes from an image (up to 4).
 * Tries native API first (can find multiple), then falls back to
 * html5-qrcode and OCR for single results.
 *
 * @returns Array of detected barcode strings (may be empty)
 */
export async function detectBarcodesFromImage(
  blob: Blob,
  hiddenElementId = 'barcode-scanner-hidden',
): Promise<string[]> {
  // Step 1: Try native BarcodeDetector API — can find multiple barcodes
  const native = await detectAllWithNativeAPI(blob);
  if (native.length > 0) {
    console.log(`[BarcodeDetector] Native API detected ${native.length} barcode(s):`, native);
    return native;
  }

  // Step 2: Try html5-qrcode (zxing-js) — returns single barcode
  const zxing = await detectWithHtml5Qrcode(blob, hiddenElementId);
  if (zxing) {
    console.log('[BarcodeDetector] html5-qrcode detected:', zxing);
    return [zxing];
  }

  // Step 3: Try OCR as last resort — returns single barcode
  const ocr = await detectWithOCR(blob);
  if (ocr) {
    console.log('[BarcodeDetector] OCR detected:', ocr);
    return [ocr];
  }

  console.warn('[BarcodeDetector] All detection methods failed');
  return [];
}

/**
 * Legacy single-barcode API — returns first detected barcode or null.
 */
export async function detectBarcodeFromImage(
  blob: Blob,
  hiddenElementId = 'barcode-scanner-hidden',
): Promise<string | null> {
  const results = await detectBarcodesFromImage(blob, hiddenElementId);
  return results[0] || null;
}

/**
 * Native BarcodeDetector API — returns ALL detected barcodes (up to 4).
 */
async function detectAllWithNativeAPI(blob: Blob): Promise<string[]> {
  try {
    const BarcodeDetector = (window as any).BarcodeDetector as typeof BarcodeDetectorAPI | undefined;
    if (!BarcodeDetector) {
      console.log('[BarcodeDetector] Native API not available in this browser');
      return [];
    }

    const bitmap = await createImageBitmap(blob);
    try {
      const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix'] });
      const results = await detector.detect(bitmap);
      // Deduplicate and limit to 4
      const unique = [...new Set(results.map((r) => r.rawValue))].slice(0, 4);
      return unique;
    } finally {
      bitmap.close();
    }
  } catch (err) {
    console.warn('[BarcodeDetector] Native API error:', err);
    return [];
  }
}

/**
 * html5-qrcode (zxing-js wrapper) — single barcode fallback.
 */
async function detectWithHtml5Qrcode(blob: Blob, elementId: string): Promise<string | null> {
  let el = document.getElementById(elementId);
  if (!el) {
    el = document.createElement('div');
    el.id = elementId;
    el.style.display = 'none';
    document.body.appendChild(el);
  }

  const file = new File([blob], 'scan.jpg', { type: blob.type || 'image/jpeg' });
  const scanner = new Html5Qrcode(elementId);

  try {
    const result = await scanner.scanFile(file, false);
    return result || null;
  } catch (err) {
    console.warn('[BarcodeDetector] html5-qrcode error:', err);
    return null;
  } finally {
    try {
      await scanner.clear();
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * OCR via Tesseract.js — single barcode fallback.
 */
async function detectWithOCR(blob: Blob): Promise<string | null> {
  try {
    const result = await extractBarcodeText(blob);
    return result;
  } catch (err) {
    console.warn('[BarcodeDetector] OCR error:', err);
    return null;
  }
}
