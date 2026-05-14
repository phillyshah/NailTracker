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
  gtinShort?: string;
  search?: string;
  expBefore?: string;
  unassigned?: boolean;
  expired?: boolean;
  expiringInDays?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export async function listInventory(filters: InventoryFilters = {}) {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === '' || v === false) continue;
    params[k] = typeof v === 'boolean' ? 'true' : (v as string | number);
  }
  return api<ListResponse>('/inventory', { params });
}

export async function getItem(id: string) {
  return api<ItemResponse>(`/inventory/${encodeURIComponent(id)}`);
}

export async function reassignItem(
  id: string,
  distributorId: string | null,
  note?: string,
  options: { skipTransferRecord?: boolean } = {},
) {
  return api<ApiResponse<{ message: string; transferId?: string | null }>>(
    `/inventory/${encodeURIComponent(id)}/reassign`,
    {
      method: 'PATCH',
      body: { distributorId, note, skipTransferRecord: options.skipTransferRecord },
    },
  );
}

export interface EditItemPayload {
  gtin?: string;
  lot?: string;
  expDate?: string | null;
  itemNumber?: string;
  productLabel?: string;
}

export async function editItem(id: string, payload: EditItemPayload) {
  return api<ApiResponse<{ id: string; udi: string; message: string }>>(
    `/inventory/${encodeURIComponent(id)}/edit`,
    { method: 'PATCH', body: payload },
  );
}

export async function markAsUsed(id: string) {
  return api<ApiResponse<{ message: string }>>(`/inventory/${encodeURIComponent(id)}/use`, {
    method: 'PATCH',
  });
}

export async function deleteItem(id: string) {
  return api<ApiResponse<{ message: string }>>(`/inventory/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
