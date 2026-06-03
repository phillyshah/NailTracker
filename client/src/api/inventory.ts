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

/**
 * Build a parsed item from manually-entered fields (Item Number / Lot /
 * Expiration). The server resolves the REF code to a GTIN and returns the same
 * shape as scanBarcode, so the result can be received exactly like a scan.
 */
export async function scanManual(params: {
  itemNumber: string;
  lot: string;
  expDate?: string | null;
}) {
  const res = await api<ScanResponse>('/inventory/scan-manual', {
    method: 'POST',
    body: params,
  });
  return res.data!;
}

/** Read a File as base64 (no data-URL prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a CSV/TXT or Excel (.xlsx) file and get back the barcode strings it
 * contains. Parsing happens server-side so .xlsx works the same on every
 * platform — the browser only reads the raw bytes.
 */
export async function parseSpreadsheet(file: File): Promise<string[]> {
  const dataBase64 = await fileToBase64(file);
  const res = await api<ApiResponse<{ barcodes: string[] }>>('/inventory/parse-spreadsheet', {
    method: 'POST',
    body: { fileName: file.name, dataBase64 },
  });
  return res.data?.barcodes ?? [];
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

/**
 * Admin maintenance: correct expiry dates on manually-entered items that were
 * saved one day early (before the local-vs-UTC date fix). Idempotent.
 */
export async function backfillManualExpiry() {
  return api<ApiResponse<{ total: number; updated: number }>>(
    '/inventory/backfill-manual-expiry',
    { method: 'POST' },
  );
}

/**
 * Admin maintenance: re-read each item's stored barcode and repair the lot
 * number / expiry / label for rows imported before the GS1 lot-parsing fix
 * (e.g. lots truncated like "J260225-L" with a bogus 2007 expiry). Idempotent.
 */
export async function backfillReparse() {
  return api<ApiResponse<{ total: number; updated: number }>>(
    '/inventory/backfill-reparse',
    { method: 'POST' },
  );
}
