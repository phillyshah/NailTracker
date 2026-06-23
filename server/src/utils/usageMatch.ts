/**
 * Deterministic FIFO selection for usage-ticket consumption.
 *
 * When several identical inventory units (same product + lot) are available in a
 * distributor's stock, a scanned sticker consumes exactly ONE of them. We pick
 * the unit that should leave the shelf first: oldest expiry, then oldest
 * createdAt (true FIFO). A unit with no expiry sorts AFTER dated units so dated
 * stock is consumed before undated stock.
 *
 * Comparisons use getTime() only (never local calendar components), so the
 * ordering is identical in every timezone.
 */
export interface UsageCandidate {
  id: string;
  expDate: Date | null;
  createdAt: Date;
}

/** Sort comparator: oldest expiry first (null last), tiebreak oldest createdAt. */
export function fifoCompare(a: UsageCandidate, b: UsageCandidate): number {
  const ax = a.expDate ? a.expDate.getTime() : Number.POSITIVE_INFINITY;
  const bx = b.expDate ? b.expDate.getTime() : Number.POSITIVE_INFINITY;
  if (ax !== bx) return ax - bx;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/** Pick the single unit to consume from the candidate list, or null if empty. */
export function pickFifo<T extends UsageCandidate>(candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(fifoCompare)[0];
}
