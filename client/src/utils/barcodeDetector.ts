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
 * Unified barcode detection pipeline.
 * Tries 3 methods in order of reliability:
 *   1. Native BarcodeDetector API (best for mobile)
 *   2. html5-qrcode scanFile (zxing-js fallback)
 *   3. Tesseract.js OCR (last resort)
 *
 * @param blob - The image to scan
 * @param hiddenElementId - DOM element ID for html5-qrcode (must exist in page)
 * @returns The detected barcode string, or null if all methods fail
 */
export async function detectBarcodeFromImage(
  blob: Blob,
  hiddenElementId = 'barcode-scanner-hidden',
): Promise<string | null> {
  // Step 1: Try native BarcodeDetector API
  const native = await detectWithNativeAPI(blob);
  if (native) {
    console.log('[BarcodeDetector] Native API detected:', native);
    return native;
  }

  // Step 2: Try html5-qrcode (zxing-js)
  const zxing = await detectWithHtml5Qrcode(blob, hiddenElementId);
  if (zxing) {
    console.log('[BarcodeDetector] html5-qrcode detected:', zxing);
    return zxing;
  }

  // Step 3: Try OCR as last resort
  const ocr = await detectWithOCR(blob);
  if (ocr) {
    console.log('[BarcodeDetector] OCR detected:', ocr);
    return ocr;
  }

  console.warn('[BarcodeDetector] All detection methods failed');
  return null;
}

/**
 * Step 1: Native BarcodeDetector API.
 * Most reliable on modern mobile browsers.
 */
async function detectWithNativeAPI(blob: Blob): Promise<string | null> {
  try {
    const BarcodeDetector = (window as any).BarcodeDetector as typeof BarcodeDetectorAPI | undefined;
    if (!BarcodeDetector) {
      console.log('[BarcodeDetector] Native API not available in this browser');
      return null;
    }

    const bitmap = await createImageBitmap(blob);
    try {
      const detector = new BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix'] });
      const results = await detector.detect(bitmap);
      if (results.length > 0) {
        return results[0].rawValue;
      }
      console.warn('[BarcodeDetector] Native API found no barcodes');
      return null;
    } finally {
      bitmap.close();
    }
  } catch (err) {
    console.warn('[BarcodeDetector] Native API error:', err);
    return null;
  }
}

/**
 * Step 2: html5-qrcode (zxing-js wrapper).
 * Fallback for browsers without native BarcodeDetector.
 */
async function detectWithHtml5Qrcode(blob: Blob, elementId: string): Promise<string | null> {
  // Ensure the hidden element exists
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
 * Step 3: OCR via Tesseract.js.
 * Reads human-readable text near the barcode and parses GS1 format.
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
