import { api } from './client';
import type { ApiResponse } from '../types';
import { asArray } from '../utils/asArray';

export interface ParLevel {
  id: string;
  scope: 'item' | 'category';
  itemNumber: string | null; // set when scope = 'item'
  category: string | null; // group name; set when scope = 'category'
  gtinShort: string | null;
  distributorId: string | null; // null = global default
  minStock: number;
  /** When set, the par is N months of cover and minStock is ignored. */
  coverMonths: number | null;
}

export interface ReorderRow {
  itemNumber: string;
  gtinShort: string;
  productLabel: string;
  distributorId: string;
  distributorName: string;
  current: number;
  par: number;
  shortage: number;
  usagePerMonth: number;
  /** How `par` was derived. */
  parBasis: 'qty' | 'cover';
  parCoverMonths?: number;
}

export interface UsageRates {
  /** `itemNumber|distributorId` -> units per month. */
  byPair: Record<string, number>;
  /** `itemNumber` -> units per month, averaged across field distributors. */
  byItem: Record<string, number>;
  windowMonths: number;
}

export async function listParLevels() {
  const res = await api<ApiResponse<ParLevel[]>>('/par-levels');
  return asArray<NonNullable<typeof res.data>[number]>(res.data);
}

/** A par is expressed as EITHER a quantity or months of cover, never both. */
type ParValue = { minStock: number; coverMonths?: null } | { coverMonths: number; minStock?: 0 };

export async function setParLevel(
  input:
    | ({ scope: 'category'; category: string } & ParValue)
    | ({
        scope?: 'item';
        itemNumber: string;
        gtinShort: string;
        distributorId?: string | null;
      } & ParValue),
) {
  const res = await api<ApiResponse<unknown>>('/par-levels', { method: 'PUT', body: input });
  return res.data!;
}

export async function getReorderReport() {
  const res = await api<ApiResponse<{ rows: ReorderRow[]; windowMonths: number }>>(
    '/par-levels/reorder',
  );
  return res.data!;
}

export async function getUsageRates() {
  const res = await api<ApiResponse<UsageRates>>('/par-levels/usage');
  return res.data!;
}

export function getReorderExportUrl() {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  return `/api/par-levels/reorder/export?${params.toString()}`;
}
