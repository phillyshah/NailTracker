import type { BatchLine } from '../api/transfers';

/**
 * Pure helpers for the batch-transfer flow. Kept separate from the page so the
 * status accounting and commit-payload shaping can be unit-tested without
 * mounting React or stubbing the API.
 */

export interface BatchCounts {
  available: number;
  not_in_stock: number;
  error: number;
  total: number;
}

export function countByStatus(lines: BatchLine[]): BatchCounts {
  let available = 0;
  let not_in_stock = 0;
  let error = 0;
  for (const l of lines) {
    if (l.status === 'available') available++;
    else if (l.status === 'not_in_stock') not_in_stock++;
    else error++;
  }
  return { available, not_in_stock, error, total: lines.length };
}

/** True when the line can be transferred (matched at source AND included). */
export function isTransferable(line: BatchLine, excluded: Set<string>): boolean {
  return (
    line.status === 'available' &&
    !!line.matchedItemId &&
    !excluded.has(line.matchedItemId)
  );
}

/**
 * Build the item snapshot list for the grouped Transfer record from the lines
 * the user kept checked. Mirrors the shape the existing Transfer page sends.
 */
export function buildTransferItems(lines: BatchLine[], excluded: Set<string>) {
  return lines
    .filter((l) => isTransferable(l, excluded))
    .map((l) => ({
      id: l.matchedItemId!,
      udi: l.parsed?.udi ?? '',
      itemNumber: l.itemNumber ?? null,
      productLabel: l.productLabel ?? l.parsed?.productLabel ?? '',
      lot: l.lot ?? l.parsed?.lot ?? '',
      gtin: l.parsed?.gtin ?? '',
      expDate: l.expDate ?? null,
    }));
}
