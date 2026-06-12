import { api } from './client';
import type { ApiResponse } from '../types';

export interface ParLevel {
  id: string;
  itemNumber: string;
  gtinShort: string;
  distributorId: string | null; // null = global default
  minStock: number;
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
}

export async function listParLevels() {
  const res = await api<ApiResponse<ParLevel[]>>('/par-levels');
  return res.data!;
}

export async function setParLevel(input: {
  itemNumber: string;
  gtinShort: string;
  distributorId?: string | null;
  minStock: number;
}) {
  const res = await api<ApiResponse<unknown>>('/par-levels', { method: 'PUT', body: input });
  return res.data!;
}

export async function getReorderReport() {
  const res = await api<ApiResponse<{ rows: ReorderRow[]; windowMonths: number }>>(
    '/par-levels/reorder',
  );
  return res.data!;
}

export function getReorderExportUrl() {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  return `/api/par-levels/reorder/export?${params.toString()}`;
}
