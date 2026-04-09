import Tesseract from 'tesseract.js';

/**
 * Extract GS1-128 barcode text from an image using OCR.
 * Preprocesses the image for higher contrast, then runs Tesseract OCR
 * and tries multiple parsing strategies on the result.
 */
export async function extractBarcodeText(imageSource: File | Blob | string): Promise<string | null> {
  try {
    // Preprocess image for better OCR accuracy
    const processed = imageSource instanceof Blob ? await preprocessForOCR(imageSource) : imageSource;

    // Run OCR with a timeout
    const result = await Promise.race([
      Tesseract.recognize(processed, 'eng', {
        logger: () => {},
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timeout')), 15000),
      ),
    ]);

    const text = result.data.text;
    console.log('[OCR] Raw text extracted:', JSON.stringify(text));

    if (!text || text.trim().length < 5) {
      console.warn('[OCR] Extracted text too short or empty');
      return null;
    }

    const barcode = parseGS1FromOCR(text);
    if (barcode) {
      console.log('[OCR] Parsed barcode:', barcode);
    } else {
      console.warn('[OCR] Could not parse GS1 data from OCR text');
    }
    return barcode;
  } catch (err) {
    console.warn('[OCR] Failed:', err);
    return null;
  }
}

/**
 * Preprocess image for OCR: convert to high-contrast grayscale.
 * This dramatically improves OCR accuracy on barcode labels.
 */
async function preprocessForOCR(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to high-contrast grayscale with adaptive threshold
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Binary threshold — makes text crisp for OCR
      const val = gray > 140 ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }

    ctx.putImageData(imageData, 0, 0);
    return await canvas.convertToBlob({ type: 'image/png' });
  } catch (err) {
    console.warn('[OCR] Preprocessing failed, using original image:', err);
    return blob;
  }
}

/**
 * Fix common OCR character confusions in digit-expected positions.
 */
function fixOCRDigits(text: string): string {
  return text
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Zz]/g, '2');
}

/**
 * Parse OCR text to find GS1 barcode data.
 * Tries 6 strategies from most to least specific.
 */
function parseGS1FromOCR(rawText: string): string | null {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');

  console.log('[OCR] Parsing strategies on text:', fullText.substring(0, 200));

  // Strategy 1: Look for parenthesized AI format — (01)...(10)...(17)...
  const parenPattern = /\(?0\s*1\)?\s*(\d[\d\s]{12,16})\s*\(?1\s*0\)?\s*([\w\d][\w\d\s\-]{2,30})\s*\(?1\s*7\)?\s*(\d[\d\s]{4,7})/i;
  const parenMatch = fullText.match(parenPattern);
  if (parenMatch) {
    const gtin = parenMatch[1].replace(/\s/g, '').slice(0, 14).padStart(14, '0');
    const lot = parenMatch[2].replace(/\s/g, '').trim();
    const exp = parenMatch[3].replace(/\s/g, '').slice(0, 6);
    if (gtin.length >= 13 && lot.length >= 2) {
      console.log('[OCR] Strategy 1 (parenthesized) matched');
      return `(01)${gtin}(10)${lot}(17)${exp}`;
    }
  }

  // Strategy 2: Look for each AI separately across the text
  const ai01 = findAI(fullText, '01', 14);
  const ai10 = findAIVariable(fullText, '10');
  const ai17 = findAI(fullText, '17', 6);

  if (ai01 && ai10) {
    let result = `(01)${ai01}(10)${ai10}`;
    if (ai17) result += `(17)${ai17}`;
    console.log('[OCR] Strategy 2 (separate AIs) matched');
    return result;
  }

  // Strategy 3: Raw format without parentheses — starts with "01" + 14 digits
  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, '');
    if (/^01\d{14}/.test(cleaned)) {
      console.log('[OCR] Strategy 3 (raw 01 prefix) matched');
      return cleaned;
    }
  }

  // Strategy 4: GTIN pattern — 14 consecutive digits starting with 0, followed by more data
  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, '');
    const gtinMatch = cleaned.match(/0(\d{13})/);
    if (gtinMatch) {
      const startIdx = cleaned.indexOf(gtinMatch[0]);
      const remainder = cleaned.slice(startIdx);
      if (remainder.length > 14) {
        console.log('[OCR] Strategy 4 (GTIN pattern) matched');
        return remainder;
      }
    }
  }

  // Strategy 5: Labeled fields — GTIN:, LOT:, EXP:, REF:, etc.
  const labeledResult = parseLabeledFields(fullText);
  if (labeledResult) {
    console.log('[OCR] Strategy 5 (labeled fields) matched');
    return labeledResult;
  }

  // Strategy 6: Look for 14-digit number anywhere + nearby lot-like pattern
  const digitResult = findGTINAndLot(fullText);
  if (digitResult) {
    console.log('[OCR] Strategy 6 (digit sequence + lot) matched');
    return digitResult;
  }

  // Strategy 7: Try with OCR character correction on the full text
  const correctedText = fixOCRDigits(fullText);
  if (correctedText !== fullText) {
    const correctedParenMatch = correctedText.match(parenPattern);
    if (correctedParenMatch) {
      const gtin = correctedParenMatch[1].replace(/\s/g, '').slice(0, 14).padStart(14, '0');
      const lot = correctedParenMatch[2].replace(/\s/g, '').trim();
      const exp = correctedParenMatch[3].replace(/\s/g, '').slice(0, 6);
      if (gtin.length >= 13 && lot.length >= 2) {
        console.log('[OCR] Strategy 7 (corrected chars + parens) matched');
        return `(01)${gtin}(10)${lot}(17)${exp}`;
      }
    }

    const correctedLabeled = parseLabeledFields(correctedText);
    if (correctedLabeled) {
      console.log('[OCR] Strategy 7 (corrected chars + labels) matched');
      return correctedLabeled;
    }
  }

  return null;
}

/**
 * Strategy 5: Parse labeled fields like GTIN:, LOT:, EXP:, etc.
 * Common on medical device labels where the human-readable text
 * has field labels printed next to values.
 */
function parseLabeledFields(text: string): string | null {
  const upper = text.toUpperCase();

  // Look for GTIN/REF/UDI value (14-digit number)
  let gtin: string | null = null;
  const gtinPatterns = [
    /(?:GTIN|REF|UDI|NDC)[:\s]*(\d[\d\s]{12,16})/i,
    /(?:GTIN|REF|UDI|NDC)[:\s#]*([0-9][\d\s\-]{12,18})/i,
  ];
  for (const pattern of gtinPatterns) {
    const match = upper.match(pattern);
    if (match) {
      gtin = match[1].replace(/[\s\-]/g, '').slice(0, 14);
      if (/^\d{13,14}$/.test(gtin)) {
        gtin = gtin.padStart(14, '0');
        break;
      }
      gtin = null;
    }
  }

  // Look for LOT value
  let lot: string | null = null;
  const lotPatterns = [
    /(?:LOT|BATCH)[:\s#]*([A-Z0-9][\w\-]{2,25})/i,
  ];
  for (const pattern of lotPatterns) {
    const match = text.match(pattern);
    if (match) {
      lot = match[1].trim();
      // Stop at common next-field labels
      lot = lot.replace(/\s*(EXP|USE|STERILE|QTY|SN).*$/i, '').trim();
      if (lot.length >= 2) break;
      lot = null;
    }
  }

  // Look for EXP date
  let exp = '';
  const expPatterns = [
    /(?:EXP|EXPIRY|EXPIRATION|USE\s*BY)[:\s]*(\d{2}[\/-]?\d{2}[\/-]?\d{2,4})/i,
    /(?:EXP|EXPIRY)[:\s]*(\d{6})/i,
  ];
  for (const pattern of expPatterns) {
    const match = text.match(pattern);
    if (match) {
      exp = match[1].replace(/[\/-]/g, '').slice(0, 6);
      break;
    }
  }

  if (gtin && lot) {
    let result = `(01)${gtin}(10)${lot}`;
    if (exp && /^\d{6}$/.test(exp)) result += `(17)${exp}`;
    return result;
  }

  return null;
}

/**
 * Strategy 6: Find a 14-digit sequence (likely GTIN) and a nearby
 * alphanumeric lot-number-like pattern.
 */
function findGTINAndLot(text: string): string | null {
  // Find all 13-14 digit sequences
  const digitMatches = text.match(/\d{13,14}/g);
  if (!digitMatches) return null;

  for (const digits of digitMatches) {
    const gtin = digits.slice(0, 14).padStart(14, '0');
    // Look for lot number after the GTIN in the text
    const afterGTIN = text.substring(text.indexOf(digits) + digits.length);
    // Lot numbers typically start with a letter or digit and contain hyphens
    const lotMatch = afterGTIN.match(/\s*[:\s]*([A-Z0-9][A-Z0-9\-]{3,25})/i);
    if (lotMatch) {
      const lot = lotMatch[1].trim();
      // Look for expiry after lot
      const afterLot = afterGTIN.substring(afterGTIN.indexOf(lot) + lot.length);
      const expMatch = afterLot.match(/\s*[:\s]*(\d{6})/);
      let result = `(01)${gtin}(10)${lot}`;
      if (expMatch) result += `(17)${expMatch[1]}`;
      return result;
    }
  }

  return null;
}

/**
 * Find a fixed-length AI value in text.
 */
function findAI(text: string, ai: string, fixedLength: number): string | null {
  const patterns = [
    new RegExp(`\\(?${ai}\\)?\\s*([\\d\\s]{${fixedLength},${fixedLength + 4}})`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match[1].replace(/\s/g, '').slice(0, fixedLength);
      if (value.length === fixedLength && /^\d+$/.test(value)) {
        return value;
      }
    }
  }
  return null;
}

/**
 * Find a variable-length AI value in text (like lot number).
 */
function findAIVariable(text: string, ai: string): string | null {
  const patterns = [
    new RegExp(`\\(?${ai}\\)?\\s*([\\w\\d][\\w\\d\\s\\-]{1,25})`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let value = match[1].trim();
      // Stop at next (XX) pattern
      const nextAI = value.match(/\s*\(?\d{2}\)?/);
      if (nextAI && nextAI.index && nextAI.index > 0) {
        value = value.slice(0, nextAI.index);
      }
      value = value.replace(/\s+/g, '').trim();
      if (value.length >= 2) {
        return value;
      }
    }
  }
  return null;
}
