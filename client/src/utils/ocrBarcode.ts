import Tesseract from 'tesseract.js';

/**
 * Extract GS1-128 barcode text from an image using OCR.
 * Looks for patterns like (01)08880089459148(10)J250929-L021(17)300928
 * in the recognized text.
 */
export async function extractBarcodeText(imageSource: File | Blob | string): Promise<string | null> {
  try {
    const result = await Tesseract.recognize(imageSource, 'eng', {
      logger: () => {}, // suppress progress logs
    });

    const text = result.data.text;
    if (!text) return null;

    // Try to find GS1 parenthesized format in the OCR text
    const barcode = parseGS1FromOCR(text);
    return barcode;
  } catch {
    return null;
  }
}

/**
 * Parse OCR text to find GS1 barcode data.
 * Handles common OCR errors (O/0 confusion, spaces, line breaks).
 */
function parseGS1FromOCR(rawText: string): string | null {
  // Clean up OCR artifacts: normalize whitespace, remove stray characters
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');

  // Strategy 1: Look for parenthesized AI format — (01)...(10)...(17)...
  // The parens might have OCR errors, so be flexible
  const parenPattern = /\(?0\s*1\)?\s*(\d[\d\s]{12,15})\s*\(?1\s*0\)?\s*([\w\d][\w\d\s\-]{2,30})\s*\(?1\s*7\)?\s*(\d[\d\s]{4,7})/i;
  const parenMatch = fullText.match(parenPattern);
  if (parenMatch) {
    const gtin = parenMatch[1].replace(/\s/g, '').slice(0, 14);
    const lot = parenMatch[2].replace(/\s/g, '').trim();
    const exp = parenMatch[3].replace(/\s/g, '').slice(0, 6);
    if (gtin.length >= 13 && lot.length >= 2) {
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
    return result;
  }

  // Strategy 3: Look for the raw text format without parentheses
  // e.g., "01 0888008945 9148 10 J250929-L021 17 300928"
  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, '');
    // Check if line starts with "01" followed by 14 digits
    if (/^01\d{14}/.test(cleaned)) {
      return cleaned;
    }
  }

  // Strategy 4: Look for GTIN pattern (14 consecutive digits starting with 0)
  // followed by lot-like text
  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, '');
    const gtinMatch = cleaned.match(/0(\d{13})/);
    if (gtinMatch) {
      const startIdx = cleaned.indexOf(gtinMatch[0]);
      const remainder = cleaned.slice(startIdx);
      if (remainder.length > 14) {
        return remainder;
      }
    }
  }

  return null;
}

/**
 * Find a fixed-length AI value in text.
 */
function findAI(text: string, ai: string, fixedLength: number): string | null {
  // Look for (XX) or XX prefix patterns
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
      // Trim and stop at the next AI marker or end
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
