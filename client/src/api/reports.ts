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
