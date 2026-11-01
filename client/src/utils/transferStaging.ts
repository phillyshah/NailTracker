import type { BatchLineParsed } from '../api/transfers';

/**
 * Pure, React-free model for the unified Transfer staging list. Every manual
 * input on the Transfer page (scan, photo, paste, typed fields, spreadsheet)
 * becomes a StagedInput; the array is the single source of truth that we
 * re-preview against source stock on every change. Kept separate from the page
 * so the append/remove/payload shaping can be unit-tested without React.
 *
 * Why a source-of-truth list (and full re-preview) instead of incremental
 * previews: the server dedups within a single request via a per-request
 * `claimed` set, so two identical scans must be previewed together to resolve
 * to one Available + one Not-in-stock rather than both claiming the same unit.
 */
export interface StagedInput {
  key: string;
  kind: 'barcode' | 'manual';
  /** Raw barcode string (scanned/photographed/pasted/spreadsheet). */
  barcode?: string;
  /** Already-parsed item (Manual Entry "fields" submode). */
  parsed?: BatchLineParsed;
}

let seq = 0;
function nextKey(): string {
  seq += 1;
  return `staged-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addBarcode(list: StagedInput[], barcode: string): StagedInput[] {
  return [...list, { key: nextKey(), kind: 'barcode', barcode }];
}

export function addManual(list: StagedInput[], parsed: BatchLineParsed): StagedInput[] {
  return [...list, { key: nextKey(), kind: 'manual', parsed }];
}

export function removeByKey(list: StagedInput[], key: string): StagedInput[] {
  return list.filter((i) => i.key !== key);
}

/**
 * Identifier the server echoes back as `BatchLine.barcode`: the raw barcode for
 * barcode inputs, or the UDI for manual items. Used to map a preview row back to
 * the staged input that produced it for removal.
 */
function inputIdentifier(input: StagedInput): string {
  return input.kind === 'barcode' ? (input.barcode ?? '') : (input.parsed?.udi ?? '');
}

/**
 * Remove exactly ONE staged input matching a preview row's identifier. Duplicate
 * inputs are interchangeable, so removing the first match is correct and avoids
 * dropping all copies of a repeated barcode.
 */
export function removeMatchingLine(list: StagedInput[], lineBarcode: string): StagedInput[] {
  const idx = list.findIndex((i) => inputIdentifier(i) === lineBarcode);
  if (idx === -1) return list;
  return [...list.slice(0, idx), ...list.slice(idx + 1)];
}

/** Split the staged list into the two payload arrays the preview endpoint takes. */
export function toPreviewPayload(list: StagedInput[]): {
  barcodes: string[];
  items: BatchLineParsed[];
} {
  const barcodes: string[] = [];
  const items: BatchLineParsed[] = [];
  for (const i of list) {
    if (i.kind === 'barcode' && i.barcode != null) barcodes.push(i.barcode);
    else if (i.kind === 'manual' && i.parsed) items.push(i.parsed);
  }
  return { barcodes, items };
}
