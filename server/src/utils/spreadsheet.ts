import ExcelJS from 'exceljs';

/**
 * Server-side spreadsheet parsing for Batch Upload.
 *
 * Batch Upload previously read the file with `file.text()` in the browser and
 * split it as CSV. That works for .csv/.txt but produces garbage for .xlsx/.xls
 * (binary ZIP/OLE2 files), so real Excel uploads silently found "no barcodes" —
 * and behaved inconsistently across desktop/mobile file pickers. Parsing here,
 * with the exceljs dependency the server already uses for exports, gives one
 * code path that behaves identically on every platform.
 *
 * Files are identified by their content signature, not their extension, so a
 * mislabeled file (or a picker that drops the extension) is still handled right.
 */

const HEADER_RE = /^(barcode|gtin|udi|code)\b/i;

/** XLSX (and other OOXML) files are ZIP archives — they start with "PK". */
export function isXlsxBuffer(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}

/** Legacy .xls (OLE2/BIFF) files start with the D0 CF 11 E0 signature. */
export function isLegacyXlsBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  );
}

function clean(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

/**
 * Pull barcode strings from delimited text (CSV / TSV / plain text). Takes the
 * first column of each row, skips a leading header row, and ignores tokens too
 * short to be a barcode.
 */
export function extractBarcodesFromText(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const startIdx = HEADER_RE.test(lines[0]) ? 1 : 0;
  const out: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const first = clean(lines[i].split(/[,;\t]/)[0] ?? '');
    if (first.length > 5) out.push(first);
  }
  return out;
}

/** Coerce any exceljs cell value into a plain string. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (typeof v.text === 'string') return v.text;
    if (Array.isArray(v.richText)) {
      return (v.richText as Array<{ text?: string }>).map((r) => r.text ?? '').join('');
    }
    if ('result' in v) return cellToString(v.result as ExcelJS.CellValue);
  }
  return String(value);
}

/**
 * Pull barcode strings from the first column of the first worksheet of an XLSX
 * workbook. Skips a leading header row and short tokens, mirroring the CSV path.
 */
export async function extractBarcodesFromXlsx(buf: Buffer): Promise<string[]> {
  const wb = new ExcelJS.Workbook();
  // exceljs's typings expect the legacy Buffer type; the cast bridges the
  // @types/node Buffer<ArrayBufferLike> generic without copying the bytes.
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const out: string[] = [];
  let seenFirst = false;
  ws.eachRow((row) => {
    const first = clean(cellToString(row.getCell(1).value));
    if (!seenFirst) {
      seenFirst = true;
      if (HEADER_RE.test(first)) return; // skip header row
    }
    if (first.length > 5) out.push(first);
  });
  return out;
}

/**
 * Extract barcode strings from an uploaded spreadsheet of any supported type.
 * Detection is by content signature so the result never depends on the file
 * extension the OS/browser reported.
 */
export async function extractBarcodes(buf: Buffer): Promise<string[]> {
  if (isXlsxBuffer(buf)) return extractBarcodesFromXlsx(buf);
  if (isLegacyXlsBuffer(buf)) {
    throw new Error(
      'Legacy .xls files are not supported. Please re-save the file as .xlsx or .csv and try again.',
    );
  }
  return extractBarcodesFromText(buf.toString('utf8'));
}
