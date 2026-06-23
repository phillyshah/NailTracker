import { createWorker, PSM, type Worker } from 'tesseract.js';
import { refToGtinShort, gtinShortToFullGtin, getAliasOverlay } from './gtin-map';

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

// REF / lot / date charset only. A whitelist stops Tesseract emitting the
// punctuation noise that breaks the field regexes; the label vocabulary is a
// closed set so dropping everything else is safe.
const OCR_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-:/. °';

let workerPromise: Promise<Worker> | null = null;

/** Lazily create — and reuse — a Tesseract worker configured for these labels. */
async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // OEM 1 = LSTM engine only — most accurate on printed text.
      const worker = await createWorker('eng', 1, { logger: () => {} });
      await worker.setParameters({
        // A single uniform block of text suits a label / sheet of stickers.
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: OCR_WHITELIST,
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Release the OCR worker. The batch Training screen creates many recognitions
 * against the reused worker; call this on unmount to free it.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  if (w) await w.terminate().catch(() => {});
}

/**
 * Run OCR on an image and return BOTH the raw text and the structured labels in
 * a single pass. Used by the OCR Training lab so admins can see exactly what the
 * matcher read and what it parsed.
 */
export async function ocrImageToLabels(
  imageSource: File | Blob | string,
): Promise<{ rawText: string; labels: ParsedLabel[] }> {
  const text = await runOCR(imageSource);
  if (!text) return { rawText: lastOcrText ?? '', labels: [] };
  return { rawText: text, labels: parseLabelsDetailed(text) };
}

/** Run Tesseract OCR over an image and return the raw text (or null). */
async function runOCR(imageSource: File | Blob | string): Promise<string | null> {
  // Preprocess image for better OCR accuracy
  const processed = imageSource instanceof Blob ? await preprocessForOCR(imageSource) : imageSource;

  const worker = await getWorker();
  // Run OCR with a timeout
  const result = await Promise.race([
    worker.recognize(processed),
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

// ─────────────────────────────────────────────────────────────────────────────
// Image preprocessing. These steps are the standard recipe for OCR on photos of
// printed labels: upscale → grayscale → contrast-stretch → local (adaptive)
// threshold. Each transform is a pure function over pixel arrays so it can be
// unit-tested on synthetic data without a canvas.
// ─────────────────────────────────────────────────────────────────────────────

/** RGBA bytes → one luma value per pixel. */
export function toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

/** Linearly rescale gray values so the darkest→0 and brightest→255. */
export function stretchContrast(gray: Uint8ClampedArray): Uint8ClampedArray {
  let min = 255;
  let max = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  const range = max - min;
  if (range < 1) return gray; // flat image — nothing to stretch
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = ((gray[i] - min) / range) * 255;
  }
  return out;
}

/** Otsu's global threshold — the fallback when adaptive thresholding can't run. */
export function otsuThreshold(gray: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Bradley adaptive threshold: each pixel is compared to the mean of its local
 * window (computed in O(1) per pixel via an integral image). Unlike a single
 * global cutoff this survives uneven lighting and shadows across a label.
 */
export function adaptiveThreshold(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  window = 15,
  c = 8,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  const w1 = width + 1;
  const integral = new Float64Array(w1 * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * w1 + (x + 1)] = integral[y * w1 + (x + 1)] + rowSum;
    }
  }
  const half = Math.max(1, Math.floor(window / 2));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(width - 1, x + half);
      const y2 = Math.min(height - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * w1 + (x2 + 1)] -
        integral[y1 * w1 + (x2 + 1)] -
        integral[(y2 + 1) * w1 + x1] +
        integral[y1 * w1 + x1];
      const mean = sum / count;
      out[y * width + x] = gray[y * width + x] > mean - c ? 255 : 0;
    }
  }
  return out;
}

/**
 * Preprocess an image for OCR: upscale small crops, then grayscale →
 * contrast-stretch → adaptive threshold to a crisp black-and-white bitmap.
 */
async function preprocessForOCR(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob);
    // Tesseract wants a decent cap height; phone crops of a sticker are often too
    // small, so upscale narrow images before processing (the biggest single win).
    const scale = bitmap.width > 0 && bitmap.width < 1000 ? Math.min(3, Math.ceil(1000 / bitmap.width)) : 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const imageData = ctx.getImageData(0, 0, width, height);
    const gray = stretchContrast(toGrayscale(imageData.data));

    let binary: Uint8ClampedArray;
    try {
      binary = adaptiveThreshold(gray, width, height);
    } catch {
      const t = otsuThreshold(gray);
      binary = new Uint8ClampedArray(gray.length);
      for (let i = 0; i < gray.length; i++) binary[i] = gray[i] > t ? 255 : 0;
    }

    const data = imageData.data;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      data[i] = data[i + 1] = data[i + 2] = binary[j];
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
    .replace(/[OQD]/g, '0')
    .replace(/I/g, '1')
    .replace(/S/g, '5')
    .replace(/G/g, '6')
    .replace(/T/g, '7')
    .replace(/B/g, '8')
    .replace(/Z/g, '2');
}

interface CatalogEntry {
  norm: string;
  ref: string;
  gtinShort: string;
}

// Catalog REF codes, pre-normalized, longest-first so prefix matching prefers
// the most specific code. Exported so a test can assert the normalized codes stay
// collision-free as new OCR character folds are added to normRef.
export const NORMALIZED_CATALOG: CatalogEntry[] = Object.entries(refToGtinShort)
  .map(([ref, gtinShort]) => ({ norm: normRef(ref), ref, gtinShort }))
  .sort((a, b) => b.norm.length - a.norm.length);

/** Bounded Levenshtein distance — returns `max + 1` as soon as it's exceeded. */
export function levenshtein(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Alias overlay, normalized the same way as the catalog. Rebuilt only when the
// underlying overlay array reference changes (set via gtin-map.setAliasOverlay).
let aliasCacheSrc: unknown = null;
let aliasCache: CatalogEntry[] = [];
function normalizedAliasOverlay(): CatalogEntry[] {
  const src = getAliasOverlay();
  if (src !== aliasCacheSrc) {
    aliasCacheSrc = src;
    aliasCache = src
      .map((e) => {
        const ref = e.canonicalRef.toUpperCase();
        const gtinShort = refToGtinShort[ref];
        const norm = normRef(e.token);
        return gtinShort && norm.length > 0 ? { norm, ref, gtinShort } : null;
      })
      .filter((x): x is CatalogEntry => x !== null)
      .sort((a, b) => b.norm.length - a.norm.length);
  }
  return aliasCache;
}

/**
 * Resolve a normalized candidate token to a catalog entry. Tries, in order:
 *   1. exact prefix against the catalog (the fast common path),
 *   2. the persisted training alias overlay (admin-confirmed mis-reads),
 *   3. a deterministic single-error Levenshtein fallback — accepted only when a
 *      unique catalog code is within distance 1 (ties are rejected).
 */
function matchCatalog(candNorm: string): CatalogEntry | null {
  const exact = NORMALIZED_CATALOG.find((c) => candNorm.startsWith(c.norm));
  if (exact) return exact;

  const alias = normalizedAliasOverlay().find((a) => candNorm.startsWith(a.norm));
  if (alias) return alias;

  let best: CatalogEntry | null = null;
  let bestDist = 2;
  let tie = false;
  for (const c of NORMALIZED_CATALOG) {
    // Only worth comparing when the candidate can cover this code's length.
    if (candNorm.length < c.norm.length - 1) continue;
    const d = levenshtein(candNorm.slice(0, c.norm.length), c.norm, 1);
    if (d <= 1) {
      if (d < bestDist) {
        bestDist = d;
        best = c;
        tie = false;
      } else if (d === bestDist) {
        tie = true;
      }
    }
  }
  return best && !tie ? best : null;
}

interface Hit {
  index: number;
}
interface RefHit extends Hit {
  ref: string;
  gtinShort: string;
}

/** Number of ORIGINAL characters that cover `normLen` normalized chars. */
function originalLenForNorm(candidate: string, normLen: number): number {
  let kept = 0;
  let i = 0;
  for (; i < candidate.length && kept < normLen; i++) {
    if (normRef(candidate[i]).length > 0) kept++;
  }
  return Math.max(i, 2); // always make progress
}

/** Find every catalogued REF code in the OCR text (fuzzy, OCR-error tolerant). */
function findRefs(text: string): RefHit[] {
  const out: RefHit[] = [];
  // Candidate tokens begin with an "SO" that OCR may have mangled into S/5 + O/0.
  const re = /[S5][O0Q][-\s]?[A-Z0-9][A-Z0-9\-\s]{4,24}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const candNorm = normRef(m[0]);
    const hit = matchCatalog(candNorm);
    if (hit) {
      out.push({ ref: hit.ref, gtinShort: hit.gtinShort, index: m.index });
      // Advance past exactly THIS ref's characters: far enough that the same
      // sticker can't match twice (which would otherwise hide genuine duplicate
      // stickers), but not so far that an adjacent next REF is skipped.
      re.lastIndex = m.index + originalLenForNorm(m[0], hit.norm.length);
    } else {
      // No catalog match — step forward minimally to find a REF starting inside.
      re.lastIndex = m.index + 2;
    }
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

/** Convert a printed date ("2030-10-20" or "301020") to GS1 YYMMDD, or '' if unusable. */
function dateToYYMMDD(raw: string): string {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return iso[1].slice(2) + iso[2] + iso[3];
  return /^\d{6}$/.test(raw) ? raw : '';
}

/**
 * Find expiry dates as YYMMDD, tagging whether each was EXP-labeled. Labels
 * routinely also print a manufacture date, so the caller prefers a labeled
 * value and otherwise the latest date — never just the first one found.
 */
function findExps(text: string): (Hit & { exp: string; labeled: boolean })[] {
  const out: (Hit & { exp: string; labeled: boolean })[] = [];
  let m: RegExpExecArray | null;
  const labeled = /(?:EXP|EXPIRY|EXPIRATION|USE\s*BY)[:\s]*(\d{6}|\d{4}-\d{2}-\d{2})/gi;
  while ((m = labeled.exec(text)) !== null) {
    const exp = dateToYYMMDD(m[1]);
    if (exp) out.push({ exp, index: m.index, labeled: true });
  }
  const iso = /(\d{4})-(\d{2})-(\d{2})/g; // any hourglass date e.g. 2030-10-20
  while ((m = iso.exec(text)) !== null) {
    out.push({ exp: m[1].slice(2) + m[2] + m[3], index: m.index, labeled: false });
  }
  return out;
}

/** Pick the best expiry for one label: a labeled EXP wins; else the latest date. */
function chooseExp(candidates: { exp: string; labeled: boolean }[]): string | undefined {
  if (candidates.length === 0) return undefined;
  const labeled = candidates.filter((c) => c.labeled);
  const pool = labeled.length > 0 ? labeled : candidates;
  // YYMMDD compares lexically as chronologically for our 20xx expiries, so the
  // max is the furthest-future date — i.e. the expiry, not a manufacture date.
  return pool.reduce((a, b) => (b.exp > a.exp ? b : a)).exp;
}

/** One implant label parsed from OCR text — both structured fields and the GS1. */
export interface ParsedLabel {
  ref: string;
  gtin: string;
  lot: string;
  exp: string | null; // GS1 YYMMDD, or null when unreadable
  gs1: string;
}

/**
 * Parse all implant labels out of a block of OCR text, returning structured
 * fields per label. On these stickers the REF code is the heading, with LOT and
 * expiry printed below it, so each LOT/expiry is attributed to the REF that most
 * recently precedes it. Exported for the OCR Training lab and unit testing.
 */
export function parseLabelsDetailed(text: string): ParsedLabel[] {
  const refs = findRefs(text).sort((a, b) => a.index - b.index);
  if (refs.length === 0) return [];
  const firstRefIdx = refs[0].index;

  const lots = findLots(text).sort((a, b) => a.index - b.index);
  const exps = findExps(text).sort((a, b) => a.index - b.index);

  // Index of the REF heading a field belongs to: the last REF at or before it.
  const ownerOf = (idx: number): number => {
    let owner = 0;
    for (let i = 0; i < refs.length; i++) {
      if (refs[i].index <= idx) owner = i;
      else break;
    }
    return owner;
  };

  // Keep the first (nearest-below) LOT under each REF. Fields printed ABOVE the
  // first REF aren't part of any label and must not be claimed by REF #0.
  const lotByRef: (string | undefined)[] = new Array(refs.length);
  for (const l of lots) {
    if (l.index < firstRefIdx) continue;
    const r = ownerOf(l.index);
    if (lotByRef[r] === undefined) lotByRef[r] = l.lot;
  }
  // Gather all expiry candidates per REF, then pick the best (labeled / latest).
  const expByRef: { exp: string; labeled: boolean }[][] = refs.map(() => []);
  for (const e of exps) {
    if (e.index < firstRefIdx) continue;
    expByRef[ownerOf(e.index)].push(e);
  }

  // No content-based de-dup: each REF occurrence is one physical sticker, so two
  // identical lot stickers in one photo correctly count as two units.
  const results: ParsedLabel[] = [];
  for (let i = 0; i < refs.length; i++) {
    const lot = lotByRef[i];
    if (!lot) continue; // a unit needs a lot to be matched in inventory
    const gtin = gtinShortToFullGtin(refs[i].gtinShort);
    const exp = chooseExp(expByRef[i]) ?? null;
    const gs1 = exp ? `(01)${gtin}(10)${lot}(17)${exp}` : `(01)${gtin}(10)${lot}`;
    results.push({ ref: refs[i].ref, gtin, lot, exp, gs1 });
  }

  return results;
}

/**
 * Parse all implant labels out of a block of OCR text into GS1 strings that
 * parseGS1 understands. Exported for unit testing.
 */
export function parseLabelsFromText(text: string): string[] {
  return parseLabelsDetailed(text).map((l) => l.gs1);
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
