import { api } from './client';
import type { ApiResponse } from '../types';
import { asArray } from '../utils/asArray';

/** What to buy from the manufacturer, one row per SKU. */
export interface PlanRow {
  itemNumber: string;
  gtinShort: string;
  productLabel: string;
  category: string;
  /** Units expected to be consumed over the horizon. */
  required: number;
  onHand: number;
  onOrder: number;
  /** required − onHand − onOrder, floored at 0. */
  gap: number;
  /** What to order: the gap, capped by what can be used before it expires. */
  suggested: number;
  cappedByShelfLife: boolean;
  perMonth: number;
}

export interface PlanAssumptions {
  casesPerMonth: number;
  leadTimeMonths: number;
  coverMonths: number;
  usableShelfMonths: number;
}

export interface OrderPlan {
  rows: PlanRow[];
  horizonMonths: number;
  totalNails: number;
  totalSuggested: number;
  cappedCount: number;
  assumptions: PlanAssumptions;
  longNailShare: number;
  /** What the plan was derived from — always shown next to the numbers. */
  evidence: {
    cases: number;
    nails: number;
    unitsConsumed: number;
    historyMonths: number;
    casesPerMonthObserved: number;
    ratios: Record<string, number>;
    byCategory: Record<string, number>;
    unmeasuredCount: number;
  };
}

export interface PlanBasis {
  sizeMix: Record<string, number>;
  ratios: Record<string, number>;
  longNailShare: number;
  nails: number;
  cases: number;
  casesPerMonthObserved: number;
  historyMonths: number;
  unitsConsumed: number;
  byCategory: Record<string, number>;
  unmeasuredItems: string[];
  onHand: Record<string, number>;
  onOrder: Record<string, number>;
  defaults: { leadTimeMonths: number; coverMonths: number; usableShelfMonths: number };
  categories: string[];
}

export interface OpenOrder {
  id: string;
  itemNumber: string;
  quantity: number;
  expectedAt: string | null;
  note: string | null;
}

/** Assumptions go on the query string, so a plan is a pure GET of typed inputs. */
function planParams(a: Partial<PlanAssumptions> & { longNailShare?: number }) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(a)) {
    if (v !== undefined && v !== null && Number.isFinite(Number(v))) params.set(k, String(v));
  }
  return params;
}

export async function getPlanBasis() {
  const res = await api<ApiResponse<PlanBasis>>('/order-plan/basis');
  return res.data!;
}

export async function getOrderPlan(a: Partial<PlanAssumptions> & { longNailShare?: number }) {
  const res = await api<ApiResponse<OrderPlan>>(`/order-plan?${planParams(a).toString()}`);
  return res.data!;
}

export async function listOpenOrders() {
  const res = await api<ApiResponse<OpenOrder[]>>('/order-plan/open-orders');
  return asArray<OpenOrder>(res.data);
}

export async function setOpenOrder(input: {
  itemNumber: string;
  quantity: number;
  note?: string | null;
  expectedAt?: string | null;
}) {
  const res = await api<ApiResponse<unknown>>('/order-plan/open-orders', {
    method: 'PUT',
    body: input,
  });
  return res.data!;
}

export function getPlanExportUrl(a: Partial<PlanAssumptions> & { longNailShare?: number }) {
  const params = planParams(a);
  const token = localStorage.getItem('token');
  if (token) params.set('token', token);
  return `/api/order-plan/export?${params.toString()}`;
}
