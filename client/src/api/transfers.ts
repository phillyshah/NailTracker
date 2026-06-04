import { api } from './client';
import type { ApiResponse } from '../types';

export interface TransferRecord {
  id: string;
  transferId: string;
  fromDistributorId: string | null;
  fromDistributorName: string;
  toDistributorId: string | null;
  toDistributorName: string;
  note: string | null;
  itemCount: number;
  items: any[];
  transferredBy: string | null;
  createdAt: string;
}

interface TransferListResponse extends ApiResponse<TransferRecord[]> {}
interface TransferResponse extends ApiResponse<TransferRecord> {}

export async function createTransfer(data: {
  fromDistributorId: string | null;
  fromDistributorName: string;
  toDistributorId: string | null;
  toDistributorName: string;
  note: string;
  items: any[];
}) {
  const res = await api<TransferResponse>('/transfers', {
    method: 'POST',
    body: data,
  });
  return res.data!;
}

export async function listTransfers(params?: { page?: number; limit?: number; search?: string }) {
  return api<TransferListResponse>('/transfers', {
    params: params as Record<string, string | number>,
  });
}

export async function getTransfer(transferId: string) {
  const res = await api<TransferResponse>(`/transfers/${encodeURIComponent(transferId)}`);
  return res.data!;
}

/**
 * Per-line shape returned by the batch-transfer preview. Mirrors UsageLine —
 * the UI renders a status badge per row and uses `parsed` to offer
 * "Add to source & include" for not_in_stock rows without re-parsing.
 */
export type BatchLineStatus = 'available' | 'not_in_stock' | 'error';

export interface BatchLineParsed {
  gtin: string;
  gtinShort: string;
  lot: string;
  expDate: string | null;
  udi: string;
  rawBarcode: string;
  productLabel: string;
}

export interface BatchLine {
  barcode: string;
  status: BatchLineStatus;
  matchedItemId?: string;
  productLabel?: string;
  itemNumber?: string | null;
  lot?: string;
  expDate?: string | null;
  availableCount?: number;
  errorMessage?: string;
  parsed?: BatchLineParsed;
}

export interface PreviewBatchResponse {
  fromDistributorId: string;
  fromDistributorName: string;
  lines: BatchLine[];
}

export async function previewBatchTransfer(data: {
  fromDistributorId: string;
  barcodes: string[];
}) {
  const res = await api<ApiResponse<PreviewBatchResponse>>('/transfers/preview-batch', {
    method: 'POST',
    body: data,
  });
  return res.data!;
}
