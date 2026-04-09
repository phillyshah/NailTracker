import { api } from './client';
import type { ApiResponse, InventoryItem, ParsedItemWithStatus } from '../types';

interface ScanResponse extends ApiResponse<{ parsed: ParsedItemWithStatus; existing: InventoryItem | null }> {}

interface AssignResponse extends ApiResponse<{ created: number; skipped: number }> {}

interface ListResponse extends ApiResponse<InventoryItem[]> {}

interface ItemResponse extends ApiResponse<InventoryItem> {}

/** Scan a single barcode — parses it and checks if it exists in the DB */
export async function scanBarcode(params: { barcode: string; imageData?: string }) {
  const res = await api<ScanResponse>('/inventory/scan', {
    method: 'POST',
    body: params,
  });
  return res.data!;
}

export async function assignItems(
  items: unknown[],
  distributorId: string | null,
  imageData?: string,
) {
  const res = await api<AssignResponse>('/inventory/assign', {
    method: 'POST',
    body: { items, distributorId, imageData },
  });
  return res.data!;
}

export interface InventoryFilters {
  page?: number;
  limit?: number;
  distributorId?: string;
  search?: string;
  expBefore?: string;
}

export async function listInventory(filters: InventoryFilters = {}) {
  return api<ListResponse>('/inventory', { params: filters as Record<string, string | number> });
}

export async function getItem(udi: string) {
  return api<ItemResponse>(`/inventory/${encodeURIComponent(udi)}`);
}

export async function reassignItem(udi: string, distributorId: string | null, note?: string) {
  return api<ApiResponse<{ message: string }>>(`/inventory/${encodeURIComponent(udi)}/reassign`, {
    method: 'PATCH',
    body: { distributorId, note },
  });
}

export async function markAsUsed(udi: string) {
  return api<ApiResponse<{ message: string }>>(`/inventory/${encodeURIComponent(udi)}/use`, {
    method: 'PATCH',
  });
}

export async function deleteItem(udi: string) {
  return api<ApiResponse<{ message: string }>>(`/inventory/${encodeURIComponent(udi)}`, {
    method: 'DELETE',
  });
}
