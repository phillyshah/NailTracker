import { getProductLabel } from './gtin-map.js';

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

/**
 * Parse a GS1-128 barcode string into structured data.
 *
 * Supports two formats:
 *   1. Parenthesized: (01)08880089459148(10)J250929-L021(17)300928
 *   2. Raw stream:    010888008945914810J250929-L02117300928
 *
 * Application Identifiers used:
 *   AI 01 — GTIN (14 digits, fixed)
 *   AI 10 — Lot number (variable length)
 *   AI 17 — Expiration date (YYMMDD, 6 digits, fixed)
 */
export function parseGS1(rawBarcode: string): ParseResult {
  const trimmed = rawBarcode.trim();
  if (!trimmed) {
    return { error: 'Empty barcode string', rawBarcode: trimmed };
  }

  let gtin = '';
  let lot = '';
  let expDateStr = '';

  // Check if parenthesized format
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
    // Raw GS1 stream — parse by known AI fixed lengths
    // Look for AI 01 (always starts with '01' followed by 14 digits)
    const ai01Idx = trimmed.indexOf('01');
    if (ai01Idx === -1 || ai01Idx + 2 + 14 > trimmed.length) {
      return { error: 'Cannot find AI 01 (GTIN) in raw barcode', rawBarcode: trimmed };
    }

    gtin = trimmed.substring(ai01Idx + 2, ai01Idx + 2 + 14);
    const rest = trimmed.substring(ai01Idx + 2 + 14);

    // Look for AI 10 and AI 17 in remaining string
    const ai17Idx = rest.indexOf('17');
    const ai10Idx = rest.indexOf('10');

    if (ai10Idx !== -1 && ai17Idx !== -1) {
      if (ai10Idx < ai17Idx) {
        // AI 10 comes before AI 17
        lot = rest.substring(ai10Idx + 2, ai17Idx);
        expDateStr = rest.substring(ai17Idx + 2, ai17Idx + 8);
      } else {
        // AI 17 comes before AI 10
        expDateStr = rest.substring(ai17Idx + 2, ai17Idx + 8);
        lot = rest.substring(ai10Idx + 2);
      }
    } else if (ai10Idx !== -1) {
      lot = rest.substring(ai10Idx + 2);
    } else if (ai17Idx !== -1) {
      expDateStr = rest.substring(ai17Idx + 2, ai17Idx + 8);
    }
  }

  // Validate GTIN
  if (!gtin || !/^\d{14}$/.test(gtin)) {
    return { error: `Invalid GTIN: must be 14 digits, got "${gtin}"`, rawBarcode: trimmed };
  }

  // Validate lot
  if (!lot) {
    return { error: 'Missing lot number (AI 10)', rawBarcode: trimmed };
  }

  // Compute gtinShort: strip leading zeros, take last 7 digits
  const gtinShort = gtin.replace(/^0+/, '').slice(-7);

  // Compute UDI
  const udi = `${gtinShort}-${lot}`;

  // Parse expiry date (YYMMDD)
  let expDate: Date | null = null;
  if (expDateStr && /^\d{6}$/.test(expDateStr)) {
    const yy = parseInt(expDateStr.substring(0, 2), 10);
    const mm = parseInt(expDateStr.substring(2, 4), 10);
    const dd = parseInt(expDateStr.substring(4, 6), 10);
    // GS1 standard: years 00-49 = 2000-2049, 50-99 = 1950-1999
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    // dd=00 means last day of month per GS1 spec
    const day = dd === 0 ? new Date(year, mm, 0).getDate() : dd;
    expDate = new Date(year, mm - 1, day);
  }

  const productLabel = getProductLabel(gtinShort);

  return {
    gtin,
    gtinShort,
    lot,
    expDate,
    udi,
    rawBarcode: trimmed,
    productLabel,
  };
}

/**
 * Parse multiple barcode strings (one per line).
 */
export function parseGS1Batch(input: string): ParseResult[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseGS1);
}
