import Tesseract from 'tesseract.js';
import { refToGtinShort, gtinShortToFullGtin } from './gtin-map';

// Raw text from the most recent OCR pass, surfaced by the scanner's debug
// toggle so unreadable labels can be diagnosed/tuned.
let lastOcrText: string | null = null;
export function getLastOcrText(): string | null {
  return lastOcrText;
}

/**
 * Extract GS1-128 barcode text from an image using OCR.
 * Preprocesses the image for higher contrast, then runs Tesseract OCR
 * and tries multiple parsing strategies on the result.
 *
 * Returns the FIRST barcode found (back-compat). Use extractAllBarcodesText
 * when an image may contain several labels.
 */
export async function extractBarcodeText(imageSource: File | Blob | string): Promise<string | null> {
  const all = await extractAllBarcodesText(imageSource);
  return all[0] ?? null;
}

/**
 * Extract EVERY label found in an image via OCR. Implant stickers on a case
 * usage sheet have no scannable barcode — only printed text (REF / LOT / expiry)
 * — and a single photo often holds several stickers, so we read all of them.
 */
export async function extractAllBarcodesText(
  imageSource: File | Blob | string,
): Promise<string[]> {
  try {
    const text = await runOCR(imageSource);
    if (!text) return [];

    // Preferred: Summa REF codes (alphanumeric, e.g. SO-S50I-SO-044-T), one per
    // sticker, mapped to their GTIN — handles the multi-label usage sheets.
    const labels = parseLabelsFromText(text);
    if (labels.length > 0) {
      console.log(`[OCR] Parsed ${labels.length} label(s) from REF codes:`, labels);
      return labels;
    }

    // Fallback: a single label printed with a numeric GTIN / GS1 stream.
    const single = parseGS1FromOCR(text);
    if (single) {
      console.log('[OCR] Parsed barcode (numeric):', single);
      return [single];
    }

    console.warn('[OCR] Could not parse any label from OCR text');
    return [];
  } catch (err) {
    console.warn('[OCR] Failed:', err);
    return [];
  }
}

/** Run Tesseract OCR over an image and return the raw text (or null). */
async function runOCR(imageSource: File | Blob | string): Promise<string | null> {
  // Preprocess image for better OCR accuracy
  const processed = imageSource instanceof Blob ? await preprocessForOCR(imageSource) : imageSource;

  // Run OCR with a timeout
  const result = await Promise.race([
    Tesseract.recognize(processed, 'eng', {
      logger: () => {},
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('OCR timeout')), 20000),
    ),
  ]);

  const text = result.data.text;
  console.log('[OCR] Raw text extracted:', JSON.stringify(text));
  lastOcrText = text ?? null;

  if (!text || text.trim().length < 5) {
    console.warn('[OCR] Extracted text too short or empty');
    return null;
  }
  return text;
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

// ─────────────────────────────────────────────────────────────────────────────
// REF-code label parsing (the implant stickers on case usage sheets)
//
// These labels carry no barcode — just printed REF / LOT / expiry text, and a
// photo usually has several. We locate each Summa REF code, map it to its GTIN
// via the catalog, pair it with the nearest LOT + expiry, and emit a GS1 string
// that parseGS1 already understands: (01)<gtin>(10)<lot>(17)<yymmdd>.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize a token for fuzzy matching against the catalog: upper-case, drop
 * separators, and fold the digit/letter pairs OCR most often confuses. The same
 * transform is applied to both sides, so e.g. "S0-S5OI-SO-O44-T" still matches
 * the catalogued "SO-S50I-SO-044-T".
 */
function normRef(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[OQ]/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/Z/g, '2');
}

// Catalog REF codes, pre-normalized, longest-first so prefix matching prefers
// the most specific code.
const NORMALIZED_CATALOG: { norm: string; ref: string; gtinShort: string }[] = Object.entries(
  refToGtinShort,
)
  .map(([ref, gtinShort]) => ({ norm: normRef(ref), ref, gtinShort }))
  .sort((a, b) => b.norm.length - a.norm.length);

interface Hit {
  index: number;
}
interface RefHit extends Hit {
  ref: string;
  gtinShort: string;
}

/** Find every catalogued REF code in the OCR text (fuzzy, OCR-error tolerant). */
function findRefs(text: string): RefHit[] {
  const out: RefHit[] = [];
  // Candidate tokens begin with an "SO" that OCR may have mangled into S/5 + O/0.
  const re = /[S5][O0Q][-\s]?[A-Z0-9][A-Z0-9\-\s]{4,24}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const candNorm = normRef(m[0]);
    const hit = NORMALIZED_CATALOG.find((c) => candNorm.startsWith(c.norm));
    if (hit) out.push({ ref: hit.ref, gtinShort: hit.gtinShort, index: m.index });
    // Don't skip a REF that starts within this (greedy) candidate.
    re.lastIndex = m.index + 2;
  }
  return out;
}

/** Find LOT values. Prefers a "LOT"-labeled value, falls back to the J######-#### shape. */
function findLots(text: string): (Hit & { lot: string })[] {
  const out: (Hit & { lot: string })[] = [];
  const labeled = /(?:LOT|BATCH)[:\s#]*([A-Z0-9][A-Z0-9\-]{3,24})/gi;
  let m: RegExpExecArray | null;
  while ((m = labeled.exec(text)) !== null) {
    const lot = cleanLot(m[1]);
    if (lot) out.push({ lot, index: m.index });
  }
  if (out.length === 0) {
    // Unlabeled fallback: lot codes look like "J251021-L015".
    const shape = /\b[A-Z][0-9]{5,7}-[A-Z]?[0-9]{2,4}\b/gi;
    while ((m = shape.exec(text)) !== null) {
      const lot = cleanLot(m[0]);
      if (lot) out.push({ lot, index: m.index });
    }
  }
  return out;
}

function cleanLot(raw: string): string | null {
  const lot = raw
    .replace(/\s+/g, '')
    .replace(/(EXP|USE|STERILE|QTY|SN|REF|DESCRIPTION|MANUFACTURED|SUMMA).*$/i, '')
    .trim();
  return lot.length >= 3 ? lot : null;
}

/** Find expiry dates as YYMMDD. Handles "2030-10-20" and a labeled 6-digit form. */
function findExps(text: string): (Hit & { exp: string })[] {
  const out: (Hit & { exp: string })[] = [];
  let m: RegExpExecArray | null;
  const iso = /(\d{4})-(\d{2})-(\d{2})/g; // hourglass date e.g. 2030-10-20
  while ((m = iso.exec(text)) !== null) {
    out.push({ exp: m[1].slice(2) + m[2] + m[3], index: m.index });
  }
  const labeled = /(?:EXP|EXPIRY|EXPIRATION|USE\s*BY)[:\s]*(\d{6})/gi;
  while ((m = labeled.exec(text)) !== null) {
    out.push({ exp: m[1], index: m.index });
  }
  return out;
}

/**
 * Parse all implant labels out of a block of OCR text. On these stickers the REF
 * code is the heading, with LOT and expiry printed below it, so each LOT/expiry
 * is attributed to the REF that most recently precedes it. Each REF becomes one
 * GS1 string that parseGS1 understands. Exported for unit testing.
 */
export function parseLabelsFromText(text: string): string[] {
  const refs = findRefs(text).sort((a, b) => a.index - b.index);
  if (refs.length === 0) return [];

  const lots = findLots(text).sort((a, b) => a.index - b.index);
  const exps = findExps(text).sort((a, b) => a.index - b.index);

  // Index of the REF heading a field belongs to: the last REF at or before it
  // (fields above the first REF fall to the first label).
  const ownerOf = (idx: number): number => {
    let owner = 0;
    for (let i = 0; i < refs.length; i++) {
      if (refs[i].index <= idx) owner = i;
      else break;
    }
    return owner;
  };

  // Keep the first (nearest-below) LOT / expiry seen under each REF.
  const lotByRef: (string | undefined)[] = new Array(refs.length);
  for (const l of lots) {
    const r = ownerOf(l.index);
    if (lotByRef[r] === undefined) lotByRef[r] = l.lot;
  }
  const expByRef: (string | undefined)[] = new Array(refs.length);
  for (const e of exps) {
    const r = ownerOf(e.index);
    if (expByRef[r] === undefined) expByRef[r] = e.exp;
  }

  const seen = new Set<string>();
  const results: string[] = [];
  for (let i = 0; i < refs.length; i++) {
    const lot = lotByRef[i];
    if (!lot) continue; // a unit needs a lot to be matched in inventory
    let gs1 = `(01)${gtinShortToFullGtin(refs[i].gtinShort)}(10)${lot}`;
    if (expByRef[i]) gs1 += `(17)${expByRef[i]}`;
    if (!seen.has(gs1)) {
      seen.add(gs1);
      results.push(gs1);
    }
  }

  return results;
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
  // Fallback: YYYY-MM-DD anywhere in text (hourglass date on labels)
  if (!exp) {
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      exp = isoMatch[1].slice(2) + isoMatch[2] + isoMatch[3];
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
      // Stop at next (XX) pattern — require explicit parentheses to avoid
      // truncating lot numbers that contain embedded digit pairs (e.g. J250929)
      const nextAI = value.match(/\s*\(\d{2}\)/);
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
