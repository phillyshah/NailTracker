import { api } from './client';
import type { ApiResponse, SummaryReport, ExpiringItem, DistributorCount } from '../types';

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

export async function getDistributorCounts() {
  const res = await api<ApiResponse<DistributorCount[]>>('/reports/distributor-counts');
  return res.data!;
}

export function getExportUrl(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters);
  const token = localStorage.getItem('token');
  if (token) params.set('token', token);
  return `/api/reports/export?${params.toString()}`;
}
