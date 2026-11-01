import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  extractBarcodes,
  extractBarcodesFromText,
  extractBarcodesFromXlsx,
  isXlsxBuffer,
  isLegacyXlsBuffer,
} from './spreadsheet.js';

const BC1 = '010888008945914810J250929-L02117300928';
const BC2 = '010888008945914810K260101-L09917300101';

/** Build a real .xlsx in memory: first column = the given cell values. */
async function makeXlsx(rows: Array<string | number>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  for (const r of rows) ws.addRow([r]);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

describe('extractBarcodesFromText', () => {
  it('reads one barcode per row from the first column', () => {
    expect(extractBarcodesFromText(`${BC1}\n${BC2}`)).toEqual([BC1, BC2]);
  });

  it('skips a header row', () => {
    expect(extractBarcodesFromText(`barcode\n${BC1}`)).toEqual([BC1]);
    expect(extractBarcodesFromText(`GTIN,Lot\n${BC1}`)).toEqual([BC1]);
  });

  it('takes only the first column and strips quotes', () => {
    expect(extractBarcodesFromText(`"${BC1}",extra,cols`)).toEqual([BC1]);
  });

  it('handles semicolon and tab delimiters and CRLF line endings', () => {
    expect(extractBarcodesFromText(`${BC1};x\r\n${BC2}\ty`)).toEqual([BC1, BC2]);
  });

  it('ignores blank lines and tokens too short to be a barcode', () => {
    expect(extractBarcodesFromText(`${BC1}\n\nabc\n   \n${BC2}`)).toEqual([BC1, BC2]);
  });
});

describe('content-signature detection', () => {
  it('recognizes a real xlsx buffer (PK zip signature)', async () => {
    const buf = await makeXlsx([BC1]);
    expect(isXlsxBuffer(buf)).toBe(true);
    expect(isLegacyXlsBuffer(buf)).toBe(false);
  });

  it('recognizes a legacy .xls (OLE2) signature', () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00]);
    expect(isLegacyXlsBuffer(ole)).toBe(true);
    expect(isXlsxBuffer(ole)).toBe(false);
  });

  it('treats plain text as neither', () => {
    const buf = Buffer.from(`${BC1}\n${BC2}`, 'utf8');
    expect(isXlsxBuffer(buf)).toBe(false);
    expect(isLegacyXlsBuffer(buf)).toBe(false);
  });
});

describe('extractBarcodesFromXlsx', () => {
  it('reads barcodes from a real .xlsx workbook', async () => {
    const buf = await makeXlsx([BC1, BC2]);
    expect(await extractBarcodesFromXlsx(buf)).toEqual([BC1, BC2]);
  });

  it('skips a header row in xlsx', async () => {
    const buf = await makeXlsx(['Barcode', BC1, BC2]);
    expect(await extractBarcodesFromXlsx(buf)).toEqual([BC1, BC2]);
  });

  it('coerces numeric cells to strings', async () => {
    const buf = await makeXlsx([1234567890123]);
    expect(await extractBarcodesFromXlsx(buf)).toEqual(['1234567890123']);
  });
});

describe('extractBarcodes (dispatch by content)', () => {
  it('parses an .xlsx buffer regardless of extension', async () => {
    const buf = await makeXlsx([BC1, BC2]);
    expect(await extractBarcodes(buf)).toEqual([BC1, BC2]);
  });

  it('parses a CSV/text buffer', async () => {
    const buf = Buffer.from(`barcode\n${BC1}\n${BC2}`, 'utf8');
    expect(await extractBarcodes(buf)).toEqual([BC1, BC2]);
  });

  it('rejects legacy .xls with a clear, actionable message', async () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00]);
    await expect(extractBarcodes(ole)).rejects.toThrow(/\.xlsx or \.csv/);
  });
});
