/**
 * Order planning for a long, uncertain manufacturer lead time.
 *
 * WHY THIS IS NOT THE REORDER REPORT
 * The reorder report answers "which distributor shelf is low" — field
 * replenishment, over weeks, excluding Home Office. This answers "what do we
 * buy from the manufacturer" — network-wide, over a year, and Home Office is
 * precisely the thing being replenished. Different scope, different horizon,
 * different failure mode, so deliberately separate code.
 *
 * WHY IT IS DRIVEN BY TYPED ASSUMPTIONS, NOT A FORECAST
 * With a new product line there are only a few months of history spread over
 * ~110 SKUs, so the modal SKU-and-distributor cell is zero. Fitting a demand
 * curve per SKU to that is self-deception. What IS reliable:
 *
 *   - Procedure volume, which the sales team knows and the database does not.
 *   - Companion ratios: one case consumes one nail and a near-fixed set of
 *     screws. A ratio has ONE parameter and converges in a few dozen cases; a
 *     per-SKU size curve has twenty and needs hundreds. So companion demand is
 *     exploded from case volume, never forecast from its own sparse history.
 *   - Size mix, pooled across the whole network rather than per distributor.
 *
 * So: cases/month (typed) x horizon -> nails -> companions via ratios -> split
 * across sizes via the observed mix -> subtract stock and what is on order ->
 * cap by shelf life.
 */

/** A SKU the plan can recommend ordering. */
export interface PlanItem {
  itemNumber: string;
  gtinShort: string;
  productLabel: string;
  /** 'Short Nail' | 'Long Nail' | 'Lag Screw' | ... */
  category: string;
}

export interface PlanAssumptions {
  /** Surgical cases per month across the whole network. The key input. */
  casesPerMonth: number;
  /** Months from placing an order to receiving it. */
  leadTimeMonths: number;
  /** Months of stock to still be holding when the order lands. */
  coverMonths: number;
  /**
   * Usable shelf life on arrival, in months. Caps every recommendation: there
   * is no point ordering more of a slow mover than can be consumed before it
   * expires. Sterile implants are commonly validated to ~5 years, less the
   * lead time already burned and a sell-through buffer — hospitals refuse
   * stock close to expiry.
   */
  usableShelfMonths: number;
}

/** Companion units consumed per nail implanted, by category. */
export type CompanionRatios = Record<string, number>;

/** Share of a category's demand going to each item number. Sums to ~1 per category. */
export type SizeMix = Record<string, number>;

export interface PlanRow {
  itemNumber: string;
  gtinShort: string;
  productLabel: string;
  category: string;
  /** Units expected to be consumed over the horizon. */
  required: number;
  onHand: number;
  onOrder: number;
  /** required - onHand - onOrder, floored at 0, before the shelf-life cap. */
  gap: number;
  /** What to actually order: the gap, capped by what can be consumed in time. */
  suggested: number;
  /** True when the shelf-life ceiling, not demand, decided the number. */
  cappedByShelfLife: boolean;
  /** Implied demand per month over the horizon — the basis for the cap. */
  perMonth: number;
}

export interface OrderPlan {
  rows: PlanRow[];
  /** Months of demand the plan covers: lead time + cover. */
  horizonMonths: number;
  /** Nails expected over the horizon — everything else derives from this. */
  totalNails: number;
  totalSuggested: number;
  cappedCount: number;
}

/**
 * Share of each item number within its own category, measured from usage.
 *
 * Pooled across the whole network on purpose. Per-distributor mix would shatter
 * an already-thin signal; the size a patient needs does not depend on which
 * distributor supplies it.
 *
 * An item with no usage gets no share. That is honest rather than helpful: the
 * caller decides what to do about unmeasured sizes, because the right answer
 * (hold one for set completeness) is a service-level decision, not a forecast.
 */
export function sizeMixFromUsage(
  usage: { itemNumber: string; category: string }[],
): SizeMix {
  const byCategory: Record<string, number> = {};
  const byItem: Record<string, number> = {};
  const itemCategory: Record<string, string> = {};

  for (const u of usage) {
    byCategory[u.category] = (byCategory[u.category] ?? 0) + 1;
    byItem[u.itemNumber] = (byItem[u.itemNumber] ?? 0) + 1;
    itemCategory[u.itemNumber] = u.category;
  }

  const mix: SizeMix = {};
  for (const item of Object.keys(byItem)) {
    const total = byCategory[itemCategory[item]];
    if (total > 0) mix[item] = byItem[item] / total;
  }
  return mix;
}

/**
 * Companion units per nail, measured from cases.
 *
 * `cases` is a list of category counts, one entry per surgical case. Only cases
 * containing at least one nail count, since the ratio is per nail; a case with
 * no nail is a data-entry artefact for this purpose.
 *
 * Known bias: a usage-ticket line that was not in recorded stock is dropped
 * rather than consumed, so a case whose screws were missing logs the nail
 * alone. Every ratio here is therefore a LOWER bound. Surface it as such.
 */
export function companionRatiosFromCases(
  cases: Record<string, number>[],
  nailCategories: string[] = ['Short Nail', 'Long Nail'],
): { ratios: CompanionRatios; nails: number; cases: number } {
  let nails = 0;
  let counted = 0;
  const totals: Record<string, number> = {};

  for (const c of cases) {
    const nailsHere = nailCategories.reduce((s, cat) => s + (c[cat] ?? 0), 0);
    if (nailsHere === 0) continue;
    nails += nailsHere;
    counted += 1;
    for (const [cat, n] of Object.entries(c)) {
      if (nailCategories.includes(cat)) continue;
      totals[cat] = (totals[cat] ?? 0) + n;
    }
  }

  const ratios: CompanionRatios = {};
  if (nails > 0) {
    for (const cat of Object.keys(totals)) ratios[cat] = +(totals[cat] / nails).toFixed(3);
  }
  return { ratios, nails, cases: counted };
}

/**
 * Build the plan.
 *
 * Nail demand splits across short/long by `nailMix` (share of nails that are
 * long), then across sizes within each family by `sizeMix`. Companion demand is
 * `totalNails x ratio`, split across that category's sizes the same way.
 */
export function buildOrderPlan(params: {
  items: PlanItem[];
  assumptions: PlanAssumptions;
  ratios: CompanionRatios;
  sizeMix: SizeMix;
  /** Share of nails that are LONG, 0..1. The one axis with no borrowable prior. */
  longNailShare: number;
  onHand: Record<string, number>;
  onOrder: Record<string, number>;
}): OrderPlan {
  const { items, assumptions, ratios, sizeMix, longNailShare, onHand, onOrder } = params;
  const { casesPerMonth, leadTimeMonths, coverMonths, usableShelfMonths } = assumptions;

  const horizonMonths = Math.max(0, leadTimeMonths) + Math.max(0, coverMonths);
  const totalNails = Math.max(0, casesPerMonth) * horizonMonths;

  // Demand for each category over the horizon. Nails split by the long/short
  // share; everything else is a multiple of total nails.
  const categoryDemand: Record<string, number> = {
    'Long Nail': totalNails * clamp01(longNailShare),
    'Short Nail': totalNails * (1 - clamp01(longNailShare)),
  };
  for (const [cat, ratio] of Object.entries(ratios)) {
    categoryDemand[cat] = totalNails * Math.max(0, ratio);
  }

  const rows: PlanRow[] = [];
  for (const item of items) {
    const catTotal = categoryDemand[item.category] ?? 0;
    const share = sizeMix[item.itemNumber] ?? 0;
    const required = Math.round(catTotal * share);

    const have = onHand[item.itemNumber] ?? 0;
    const coming = onOrder[item.itemNumber] ?? 0;
    const gap = Math.max(0, required - have - coming);

    // Never order more than can be consumed before it expires. This is what
    // stops the plan degenerating into "order more of everything" on the tail.
    const perMonth = horizonMonths > 0 ? required / horizonMonths : 0;
    const shelfCeiling = Math.max(0, Math.ceil(perMonth * Math.max(0, usableShelfMonths) - have));
    const suggested = Math.min(gap, shelfCeiling);

    if (required === 0 && gap === 0) continue; // nothing to say about this SKU

    rows.push({
      itemNumber: item.itemNumber,
      gtinShort: item.gtinShort,
      productLabel: item.productLabel,
      category: item.category,
      required,
      onHand: have,
      onOrder: coming,
      gap,
      suggested,
      cappedByShelfLife: suggested < gap,
      perMonth: +perMonth.toFixed(2),
    });
  }

  rows.sort(
    (a, b) =>
      b.suggested - a.suggested ||
      a.category.localeCompare(b.category) ||
      a.itemNumber.localeCompare(b.itemNumber),
  );

  return {
    rows,
    horizonMonths,
    totalNails: Math.round(totalNails),
    totalSuggested: rows.reduce((s, r) => s + r.suggested, 0),
    cappedCount: rows.filter((r) => r.cappedByShelfLife).length,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
