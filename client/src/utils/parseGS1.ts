import { getProductLabel } from './gtin-map';

export interface ParsedBarcode {
  gtin: string;
  gtinShort: string;
  lot: string;
  expDate: Date | null;
  udi: string;
  rawBarcode: string;
  productLabel: string;
}

export interface ParseError {
  error: string;
  rawBarcode: string;
}

export type ParseResult = ParsedBarcode | ParseError;

export function isParseError(result: ParseResult): result is ParseError {
  return 'error' in result;
}

// GS1 FNC1 separator (Group Separator, ASCII 29). Real scanners insert it
// between variable-length fields, which makes parsing unambiguous when present.
const GS = String.fromCharCode(29);

// Fixed-length AIs (character count AFTER the 2-digit AI). AI 10 (lot) and 21
// (serial) are variable-length and handled separately.
const FIXED_AI_LEN: Record<string, number> = {
  '01': 14, // GTIN
  '11': 6, // production date
  '12': 6, // due date
  '13': 6, // packaging date
  '15': 6, // best-before date
  '16': 6, // sell-by date
  '17': 6, // expiration date (YYMMDD)
};

function isValidYYMMDD(s: string): boolean {
  if (!/^\d{6}$/.test(s)) return false;
  const mm = parseInt(s.slice(2, 4), 10);
  const dd = parseInt(s.slice(4, 6), 10);
  // dd === 0 is legal per GS1 (means "end of month").
  return mm >= 1 && mm <= 12 && dd >= 0 && dd <= 31;
}

/**
 * End index of a variable-length field (AI 10/21) starting at `start`, when no
 * FNC1 separator is present. The field's end is otherwise ambiguous, so we peel
 * a trailing expiry (…17YYMMDD) off the END (greedy) only when it forms a valid
 * date. This is what distinguishes the real AI 17 from a "17" that merely occurs
 * inside the lot data — e.g. lot "J260225-L170" contains "17" in "L170", which
 * the old indexOf('17') split on, truncating the lot and corrupting the date.
 */
function variableFieldEnd(rest: string, start: number): number {
  const tail = rest.slice(start);
  const m = tail.match(/^(.*)17(\d{6})$/); // greedy → the LAST "17"+6 digits
  if (m && isValidYYMMDD(m[2])) return start + m[1].length;
  return rest.length;
}

/**
 * Parse a raw (non-parenthesized) GS1-128 stream left-to-right by Application
 * Identifier, instead of guessing positions with indexOf. Returns null if no
 * GTIN (AI 01) can be located.
 */
function parseRawStream(s: string): { gtin: string; lot: string; expDateStr: string } | null {
  // GTIN — AI 01, fixed 14 digits. Prefer the start; fall back to a search.
  const gtinIdx = s.startsWith('01') ? 0 : s.indexOf('01');
  if (gtinIdx === -1 || gtinIdx + 16 > s.length) return null;
  const gtin = s.slice(gtinIdx + 2, gtinIdx + 16);
  if (!/^\d{14}$/.test(gtin)) return null;

  const rest = s.slice(gtinIdx + 16);
  let lot = '';
  let expDateStr = '';

  let i = 0;
  while (i < rest.length) {
    if (rest[i] === GS) {
      i += 1;
      continue;
    }
    const ai = rest.slice(i, i + 2);
    if (ai === '17') {
      expDateStr = rest.slice(i + 2, i + 8);
      i += 8;
    } else if (ai === '10' || ai === '21') {
      const sep = rest.indexOf(GS, i + 2);
      const end = sep !== -1 ? sep : variableFieldEnd(rest, i + 2);
      const val = rest.slice(i + 2, end);
      if (ai === '10') lot = val; // serial (21) is not stored
      i = end;
    } else if (FIXED_AI_LEN[ai] !== undefined) {
      // A fixed-length AI we don't store (e.g. production date) — skip past it.
      i += 2 + FIXED_AI_LEN[ai];
    } else {
      // Unrecognized AI boundary — stop rather than corrupt the lot.
      break;
    }
  }

  return { gtin, lot, expDateStr };
}

export function parseGS1(rawBarcode: string): ParseResult {
  const trimmed = rawBarcode.trim();
  if (!trimmed) {
    return { error: 'Empty barcode string', rawBarcode: trimmed };
  }

  let gtin = '';
  let lot = '';
  let expDateStr = '';

  if (trimmed.includes('(')) {
    const aiPattern = /\((\d{2})\)([^(]*)/g;
    let match: RegExpExecArray | null;
    const fields: Record<string, string> = {};

    while ((match = aiPattern.exec(trimmed)) !== null) {
      fields[match[1]] = match[2].trim();
    }

    gtin = fields['01'] || '';
    lot = fields['10'] || '';
    expDateStr = fields['17'] || '';
  } else {
    // Raw GS1 stream — parse left-to-right by Application Identifier.
    const raw = parseRawStream(trimmed);
    if (!raw) {
      return { error: 'Cannot find AI 01 (GTIN) in raw barcode', rawBarcode: trimmed };
    }
    gtin = raw.gtin;
    lot = raw.lot;
    expDateStr = raw.expDateStr;
  }

  if (!gtin || !/^\d{14}$/.test(gtin)) {
    return { error: `Invalid GTIN: must be 14 digits, got "${gtin}"`, rawBarcode: trimmed };
  }

  if (!lot) {
    return { error: 'Missing lot number (AI 10)', rawBarcode: trimmed };
  }

  const gtinShort = gtin.replace(/^0+/, '').slice(-7);
  const udi = `${gtinShort}-${lot}`;

  let expDate: Date | null = null;
  if (expDateStr && /^\d{6}$/.test(expDateStr)) {
    const yy = parseInt(expDateStr.substring(0, 2), 10);
    const mm = parseInt(expDateStr.substring(2, 4), 10);
    const dd = parseInt(expDateStr.substring(4, 6), 10);
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    const day = dd === 0 ? new Date(Date.UTC(year, mm, 0)).getUTCDate() : dd;
    // Calendar dates are stored at UTC midnight so the scanned day renders the
    // same in every timezone (see utils/expiry.ts).
    expDate = new Date(Date.UTC(year, mm - 1, day));
  }

  // Fallback: detect YYYY-MM-DD date from rawBarcode (hourglass label format)
  if (!expDate) {
    const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (y >= 2000 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        expDate = new Date(Date.UTC(y, m - 1, d));
      }
    }
  }

  const productLabel = getProductLabel(gtinShort, trimmed);

  return { gtin, gtinShort, lot, expDate, udi, rawBarcode: trimmed, productLabel };
}

export function parseGS1Batch(input: string): ParseResult[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseGS1);
}
