import { api } from './client';
import type { ApiResponse } from '../types';

export interface HoldingItem {
  id: string;
  itemNumber: string | null;
  productLabel: string | null;
  lot: string;
  expDate: string | null;
}

export interface HoldingGroup {
  locationId: string;
  locationName: string;
  count: number;
  items: HoldingItem[];
}

export interface HoldingsResponse {
  asOf: string | null;
  total: number;
  groups: HoldingGroup[];
}

export async function getHoldings(params: { asOf?: string }) {
  const res = await api<ApiResponse<HoldingsResponse>>('/holdings', {
    params: { asOf: params.asOf },
  });
  return res.data!;
}

export function getHoldingsExportUrl(params: { asOf?: string }) {
  const sp = new URLSearchParams();
  if (params.asOf) sp.set('asOf', params.asOf);
  const token = localStorage.getItem('token');
  if (token) sp.set('token', token);
  return `/api/holdings/export?${sp.toString()}`;
}
