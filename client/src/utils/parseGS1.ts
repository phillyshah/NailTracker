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
    const ai01Idx = trimmed.indexOf('01');
    if (ai01Idx === -1 || ai01Idx + 2 + 14 > trimmed.length) {
      return { error: 'Cannot find AI 01 (GTIN) in raw barcode', rawBarcode: trimmed };
    }

    gtin = trimmed.substring(ai01Idx + 2, ai01Idx + 2 + 14);
    const rest = trimmed.substring(ai01Idx + 2 + 14);

    const ai17Idx = rest.indexOf('17');
    const ai10Idx = rest.indexOf('10');

    if (ai10Idx !== -1 && ai17Idx !== -1) {
      if (ai10Idx < ai17Idx) {
        lot = rest.substring(ai10Idx + 2, ai17Idx);
        expDateStr = rest.substring(ai17Idx + 2, ai17Idx + 8);
      } else {
        expDateStr = rest.substring(ai17Idx + 2, ai17Idx + 8);
        lot = rest.substring(ai10Idx + 2);
      }
    } else if (ai10Idx !== -1) {
      lot = rest.substring(ai10Idx + 2);
    } else if (ai17Idx !== -1) {
      expDateStr = rest.substring(ai17Idx + 2, ai17Idx + 8);
    }
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
    const day = dd === 0 ? new Date(year, mm, 0).getDate() : dd;
    expDate = new Date(year, mm - 1, day);
  }

  const productLabel = getProductLabel(gtinShort);

  return { gtin, gtinShort, lot, expDate, udi, rawBarcode: trimmed, productLabel };
}

export function parseGS1Batch(input: string): ParseResult[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseGS1);
}
