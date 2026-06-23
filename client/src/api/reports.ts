import { api } from './client';
import type { ApiResponse, SummaryReport, ExpiringItem } from '../types';

export async function getSummary() {
  const res = await api<ApiResponse<SummaryReport>>('/reports/summary');
  return res.data!;
}

export async function getExpiring(days = 90) {
  const res = await api<ApiResponse<ExpiringItem[]>>('/reports/expiring', {
    params: { days },
  });
  return res.data!;
}

export interface StockLocation {
  id: string;
  name: string;
}
export interface StockByItemRow {
  gtinShort: string;
  itemNumber: string;
  productLabel: string;
  counts: Record<string, number>;
  total: number;
}
export interface StockByItemResponse {
  locations: StockLocation[];
  rows: StockByItemRow[];
}

export async function getStockByItem() {
  const res = await api<ApiResponse<StockByItemResponse>>('/reports/stock-by-item');
  return res.data!;
}

export function getStockByItemExportUrl() {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  return `/api/reports/stock-by-item/export?${params.toString()}`;
}

// ---- Usage analytics ------------------------------------------------------

export interface UsageTrendsResponse {
  window: number;
  months: string[];
  categories: string[];
  series: { category: string; byMonth: Record<string, number>; total: number }[];
  totalsByMonth: Record<string, number>;
  total: number;
}

export interface UsageMatrixResponse {
  window: number;
  columns: { id: string; name: string }[];
  rows: { category: string; counts: Record<string, number>; total: number }[];
  totalsByColumn: Record<string, number>;
  grandTotal: number;
}

export interface MonthlyUsageItem {
  gtinShort: string;
  itemNumber: string | null;
  productLabel: string;
  category: string;
  qty: number;
}
export interface MonthlyUsageResponse {
  month: string;
  groups: {
    distributorId: string | null;
    distributorName: string;
    items: MonthlyUsageItem[];
    subtotal: number;
  }[];
  grandTotal: number;
}

export async function getUsageTrends(params: { months: number; distributorId?: string }) {
  const res = await api<ApiResponse<UsageTrendsResponse>>('/reports/usage-trends', {
    params: { months: params.months, distributorId: params.distributorId },
  });
  return res.data!;
}

export async function getUsageMatrix(params: { months: number }) {
  const res = await api<ApiResponse<UsageMatrixResponse>>('/reports/usage-matrix', {
    params: { months: params.months },
  });
  return res.data!;
}

export async function getMonthlyUsage(params: { month: string; distributorId?: string }) {
  const res = await api<ApiResponse<MonthlyUsageResponse>>('/reports/monthly-usage', {
    params: { month: params.month, distributorId: params.distributorId },
  });
  return res.data!;
}

/** Build an authed export URL (token as a query param, like the other exports). */
function exportUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const token = localStorage.getItem('token');
  if (token) sp.set('token', token);
  return `/api/reports/${path}?${sp.toString()}`;
}

export function getUsageTrendsExportUrl(p: { months: number; distributorId?: string }) {
  return exportUrl('usage-trends/export', p);
}
export function getUsageMatrixExportUrl(p: { months: number }) {
  return exportUrl('usage-matrix/export', p);
}
export function getMonthlyUsageExportUrl(p: { month: string; distributorId?: string }) {
  return exportUrl('monthly-usage/export', p);
}

export function getExportUrl(filters?: Record<string, unknown>) {
  const params = new URLSearchParams();
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === null || v === '' || v === false) continue;
      if (k === 'page' || k === 'limit') continue;
      params.set(k, typeof v === 'boolean' ? 'true' : String(v));
    }
  }
  const token = localStorage.getItem('token');
  if (token) params.set('token', token);
  return `/api/reports/export?${params.toString()}`;
}
