import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { success, error } from '../utils/response.js';
import {
  getItemNumber,
  getProductCategory,
  PRODUCT_CATEGORIES,
  productCatalog,
} from '../utils/gtin-map.js';
import {
  buildOrderPlan,
  companionRatiosFromCases,
  sizeMixFromUsage,
  type CompanionRatios,
  type PlanItem,
  type SizeMix,
} from '../utils/orderPlan.js';

/** Average month in milliseconds — 365.25/12 days. Matches utils/usageRate.ts. */
const MONTH_MS = 2_629_800_000;

/**
 * Fallback assumptions. Deliberately conservative on lead time: the user's
 * manufacturer has quoted 6-12 months, so planning on the short end is the
 * failure mode we are trying to avoid. Shelf life assumes sterile implants
 * validated to ~5 years, less a year of sell-through buffer — hospitals refuse
 * stock close to expiry.
 */
const DEFAULTS = {
  leadTimeMonths: 9,
  coverMonths: 6,
  usableShelfMonths: 48,
};

/** The categories that are nails — demand for everything else derives from these. */
const NAIL_CATEGORIES = ['Short Nail', 'Long Nail'];

type UsedRow = {
  gtinShort: string;
  rawBarcode: string;
  usedAt: Date | null;
  usageTicketId: string | null;
};

interface Basis {
  /** Share of each item number within its category, from observed usage. */
  sizeMix: SizeMix;
  /** Companion units consumed per nail implanted. A LOWER bound — see orderPlan.ts. */
  ratios: CompanionRatios;
  /** Share of nails that are long, 0..1. */
  longNailShare: number;
  /** Evidence behind the ratios. */
  nails: number;
  cases: number;
  /** Cases per month over the history that exists. The default for the input. */
  casesPerMonthObserved: number;
  /** Months between the first recorded use and now. */
  historyMonths: number;
  unitsConsumed: number;
  /** Units consumed by category, so the ratios can be sanity-checked. */
  byCategory: Record<string, number>;
  /** Catalogue SKUs never consumed — they get no size share, so no plan row. */
  unmeasuredItems: string[];
  onHand: Record<string, number>;
  onOrder: Record<string, number>;
}

/**
 * Everything the plan is derived FROM, measured rather than typed.
 *
 * Stock is network-wide and includes Home Office, unlike the reorder report:
 * this answers "what do we buy from the manufacturer", and Home Office stock is
 * precisely what a purchase replenishes.
 */
async function gatherBasis(): Promise<Basis> {
  const [used, stock, openOrders] = await Promise.all([
    prisma.inventoryItem.findMany({
      // All of history, not a rolling window. The line is new; there is no
      // history to spare, and a window would only shrink an already-thin sample.
      where: { deletedAt: null, usedAt: { not: null } },
      select: { gtinShort: true, rawBarcode: true, usedAt: true, usageTicketId: true },
    }),
    prisma.inventoryItem.findMany({
      where: { deletedAt: null, usedAt: null },
      select: { gtinShort: true, rawBarcode: true },
    }),
    prisma.openOrder.findMany(),
  ]);

  const usage = (used as UsedRow[]).map((it) => ({
    itemNumber: getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort,
    category: getProductCategory(it.gtinShort, it.rawBarcode) as string,
    usedAt: it.usedAt,
    ticket: it.usageTicketId,
  }));

  const sizeMix = sizeMixFromUsage(usage);

  const byCategory: Record<string, number> = {};
  for (const u of usage) byCategory[u.category] = (byCategory[u.category] ?? 0) + 1;

  // One usage ticket is one surgical case (confirmed with the user), which is
  // what makes a per-case companion ratio meaningful. Units marked used
  // directly carry no ticket and so cannot be attributed to a case — including
  // them as cases of their own would drag every ratio toward zero.
  const caseMap = new Map<string, Record<string, number>>();
  for (const u of usage) {
    if (!u.ticket) continue;
    const c = caseMap.get(u.ticket) ?? {};
    c[u.category] = (c[u.category] ?? 0) + 1;
    caseMap.set(u.ticket, c);
  }
  const { ratios, nails, cases } = companionRatiosFromCases(
    Array.from(caseMap.values()),
    NAIL_CATEGORIES,
  );

  const longs = byCategory['Long Nail'] ?? 0;
  const shorts = byCategory['Short Nail'] ?? 0;
  const longNailShare = longs + shorts > 0 ? +(longs / (longs + shorts)).toFixed(3) : 0;

  const stamps = usage.map((u) => u.usedAt?.getTime() ?? 0).filter((t) => t > 0);
  const historyMonths = stamps.length
    ? Math.max(1, (Date.now() - Math.min(...stamps)) / MONTH_MS)
    : 0;
  const casesPerMonthObserved = historyMonths > 0 ? +(caseMap.size / historyMonths).toFixed(2) : 0;

  const onHand: Record<string, number> = {};
  for (const it of stock as { gtinShort: string; rawBarcode: string }[]) {
    const key = getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort;
    onHand[key] = (onHand[key] ?? 0) + 1;
  }

  const onOrder: Record<string, number> = {};
  for (const o of openOrders as { itemNumber: string; quantity: number }[]) {
    onOrder[o.itemNumber] = (onOrder[o.itemNumber] ?? 0) + o.quantity;
  }

  return {
    sizeMix,
    ratios,
    longNailShare,
    nails,
    cases,
    casesPerMonthObserved,
    historyMonths: +historyMonths.toFixed(1),
    unitsConsumed: usage.length,
    byCategory,
    unmeasuredItems: productCatalog
      .filter((c) => sizeMix[c.itemNumber] === undefined)
      .map((c) => c.itemNumber),
    onHand,
    onOrder,
  };
}

/** Catalogue items in the shape the planner wants, with the finer category. */
function planItems(): PlanItem[] {
  return productCatalog.map((c) => ({
    itemNumber: c.itemNumber,
    gtinShort: c.gtinShort,
    productLabel: c.productLabel,
    category: getProductCategory(c.gtinShort) as string,
  }));
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * GET /api/order-plan/basis — what the database knows, so the screen can show
 * the derived ratios and defaults before anything is planned.
 */
export async function basis(_req: Request, res: Response) {
  try {
    const b = await gatherBasis();
    return success(res, { ...b, defaults: DEFAULTS, categories: PRODUCT_CATEGORIES });
  } catch (err) {
    return error(res, 'Failed to gather planning basis', 500);
  }
}

async function buildFromQuery(req: Request) {
  const b = await gatherBasis();
  const q = req.query;
  const assumptions = {
    casesPerMonth: Math.max(0, num(q.casesPerMonth, b.casesPerMonthObserved)),
    leadTimeMonths: Math.max(0, num(q.leadTimeMonths, DEFAULTS.leadTimeMonths)),
    coverMonths: Math.max(0, num(q.coverMonths, DEFAULTS.coverMonths)),
    usableShelfMonths: Math.max(0, num(q.usableShelfMonths, DEFAULTS.usableShelfMonths)),
  };
  const longNailShare = num(q.longNailShare, b.longNailShare);
  const plan = buildOrderPlan({
    items: planItems(),
    assumptions,
    ratios: b.ratios,
    sizeMix: b.sizeMix,
    longNailShare,
    onHand: b.onHand,
    onOrder: b.onOrder,
  });
  return { plan, assumptions, longNailShare, basis: b };
}

/**
 * GET /api/order-plan — the plan itself.
 *
 * Every assumption is a query parameter so the screen can re-plan on each
 * keystroke without storing anything; nothing here writes.
 */
export async function plan(req: Request, res: Response) {
  try {
    const { plan: p, assumptions, longNailShare, basis: b } = await buildFromQuery(req);
    return success(res, {
      ...p,
      assumptions,
      longNailShare,
      evidence: {
        cases: b.cases,
        nails: b.nails,
        unitsConsumed: b.unitsConsumed,
        historyMonths: b.historyMonths,
        casesPerMonthObserved: b.casesPerMonthObserved,
        ratios: b.ratios,
        byCategory: b.byCategory,
        unmeasuredCount: b.unmeasuredItems.length,
      },
    });
  } catch (err) {
    return error(res, 'Failed to build order plan', 500);
  }
}

/** GET /api/order-plan/export — the same plan as .xlsx, to send to the manufacturer. */
export async function exportPlan(req: Request, res: Response) {
  try {
    const { plan: p, assumptions, longNailShare, basis: b } = await buildFromQuery(req);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Order Plan');
    sheet.columns = [
      { header: 'Item Number', key: 'itemNumber', width: 26 },
      { header: 'Description', key: 'productLabel', width: 36 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Needed Over Horizon', key: 'required', width: 20 },
      { header: 'On Hand', key: 'onHand', width: 10 },
      { header: 'On Order', key: 'onOrder', width: 10 },
      { header: 'Shortfall', key: 'gap', width: 12 },
      { header: 'Suggested Order', key: 'suggested', width: 16 },
      { header: 'Demand / mo', key: 'perMonth', width: 12 },
      { header: 'Shelf-Life Capped', key: 'cappedLabel', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of p.rows) {
      sheet.addRow({ ...r, cappedLabel: r.cappedByShelfLife ? 'Yes' : '' });
    }
    sheet.getColumn('suggested').font = { bold: true };

    // The assumptions travel with the numbers. A plan read six months from now
    // without them is unauditable — nobody could tell demand from guesswork.
    const info = workbook.addWorksheet('Assumptions');
    info.columns = [
      { header: 'Input', key: 'k', width: 34 },
      { header: 'Value', key: 'v', width: 18 },
      { header: 'Source', key: 's', width: 46 },
    ];
    info.getRow(1).font = { bold: true };
    const rows: { k: string; v: string | number; s: string }[] = [
      { k: 'Surgical cases per month', v: assumptions.casesPerMonth, s: 'Typed in' },
      { k: 'Lead time (months)', v: assumptions.leadTimeMonths, s: 'Typed in' },
      { k: 'Cover on arrival (months)', v: assumptions.coverMonths, s: 'Typed in' },
      { k: 'Planning horizon (months)', v: p.horizonMonths, s: 'Lead time + cover' },
      { k: 'Usable shelf life (months)', v: assumptions.usableShelfMonths, s: 'Typed in' },
      {
        k: 'Long nail share',
        v: `${Math.round(longNailShare * 100)}%`,
        s: `Observed across ${b.nails} nails`,
      },
      { k: 'Nails over horizon', v: p.totalNails, s: 'Cases per month x horizon' },
      {
        k: 'Cases observed',
        v: b.cases,
        s: `${b.historyMonths} months of history (${b.casesPerMonthObserved}/mo)`,
      },
      { k: 'Units consumed', v: b.unitsConsumed, s: 'All recorded usage' },
    ];
    for (const [cat, ratio] of Object.entries(b.ratios)) {
      rows.push({
        k: `${cat} per nail`,
        v: ratio,
        s: 'Observed per case — a LOWER bound (unrecorded screws are invisible)',
      });
    }
    rows.push({
      k: 'Shelf-life capped rows',
      v: p.cappedCount,
      s: 'Suggested quantity limited by expiry, not demand',
    });
    for (const r of rows) info.addRow(r);

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="order-plan-${dateStr}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return error(res, 'Export failed', 500);
  }
}

/** GET /api/order-plan/open-orders — what is already on order, per item. */
export async function listOpenOrders(_req: Request, res: Response) {
  try {
    const orders = await prisma.openOrder.findMany({ orderBy: { itemNumber: 'asc' } });
    return success(res, orders);
  } catch (err) {
    return error(res, 'Failed to fetch open orders', 500);
  }
}

/**
 * PUT /api/order-plan/open-orders — record (or clear) what is on order.
 *
 * Deliberately not a purchase-order subsystem: one number per item, typed by
 * whoever placed the order, so the plan nets out what is already coming. A
 * quantity of 0 removes the row.
 */
export async function upsertOpenOrder(req: Request, res: Response) {
  try {
    const { itemNumber, quantity, note, expectedAt } = req.body as {
      itemNumber?: string;
      quantity?: number;
      note?: string | null;
      expectedAt?: string | null;
    };
    if (!itemNumber || !itemNumber.trim()) return error(res, 'itemNumber is required');

    const qty = Number(quantity ?? 0);
    if (!Number.isFinite(qty) || qty < 0) return error(res, 'quantity must be 0 or greater');

    const item = itemNumber.trim();
    if (qty === 0) {
      await prisma.openOrder.deleteMany({ where: { itemNumber: item } });
      return success(res, { itemNumber: item, quantity: 0, cleared: true });
    }

    let expected: Date | null = null;
    if (expectedAt) {
      const d = new Date(expectedAt);
      if (Number.isNaN(d.getTime())) return error(res, 'expectedAt is not a valid date');
      expected = d;
    }

    const saved = await prisma.openOrder.upsert({
      where: { itemNumber: item },
      update: { quantity: Math.round(qty), note: note ?? null, expectedAt: expected },
      create: {
        itemNumber: item,
        quantity: Math.round(qty),
        note: note ?? null,
        expectedAt: expected,
      },
    });
    return success(res, saved);
  } catch (err) {
    return error(res, 'Failed to save open order', 500);
  }
}
