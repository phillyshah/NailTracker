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
 * Whether the user can advance to the Review/Confirm step. Both staged modes
 * ('manual' and 'excel') share the batch-preview flow, so they gate on the
 * included-line count; 'pick' gates on the selection. A destination is always
 * required. Pure so every mode stays covered (a missing mode here is exactly
 * what hid the Review button in Import-from-Excel).
 */
export function canReviewTransfer(params: {
  mode: 'pick' | 'manual' | 'excel';
  selectedCount: number;
  includedCount: number;
  hasDestination: boolean;
}): boolean {
  const { mode, selectedCount, includedCount, hasDestination } = params;
  if (!hasDestination) return false;
  if (mode === 'pick') return selectedCount > 0;
  return includedCount > 0; // 'manual' or 'excel'
}

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
