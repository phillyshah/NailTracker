import { api } from './client';
import type { ApiResponse } from '../types';

export type UsageLineStatus = 'available' | 'not_in_stock' | 'error';

/** One scanned sticker, resolved against a distributor's stock (preview). */
export interface UsageLine {
  barcode: string;
  status: UsageLineStatus;
  matchedItemId?: string;
  productLabel?: string;
  itemNumber?: string | null;
  lot?: string;
  expDate?: string | null;
  availableCount?: number;
  errorMessage?: string;
}

export interface UsagePreviewResult {
  distributorId: string;
  distributorName: string;
  lines: UsageLine[];
}

export interface UsageTicketItem {
  id: string;
  udi: string;
  itemNumber: string | null;
  productLabel: string | null;
  lot: string;
  gtin: string;
  expDate: string | null;
}

export interface UsageCommitResult {
  ticketId: string;
  consumed: number;
  blocked: { id: string; reason: string }[];
  items: UsageTicketItem[];
}

export interface UsageTicketRecord {
  id: string;
  ticketId: string;
  distributorId: string | null;
  distributorName: string;
  note: string | null;
  itemCount: number;
  items: UsageTicketItem[];
  recordedBy: string | null;
  createdAt: string;
}

/** Resolve scanned barcodes against one distributor's available stock (no mutation). */
export async function previewUsage(distributorId: string, barcodes: string[]) {
  const res = await api<ApiResponse<UsagePreviewResult>>('/usage/preview', {
    method: 'POST',
    body: { distributorId, barcodes },
  });
  return res.data!;
}

/** Consume the confirmed units, creating one usage ticket. */
export async function commitUsage(distributorId: string, itemIds: string[], note?: string) {
  const res = await api<ApiResponse<UsageCommitResult>>('/usage/commit', {
    method: 'POST',
    body: { distributorId, itemIds, note },
  });
  return res.data!;
}

export async function listUsage(params?: { page?: number; limit?: number; search?: string }) {
  return api<ApiResponse<UsageTicketRecord[]>>('/usage', {
    params: params as Record<string, string | number>,
  });
}

export async function getUsageTicket(ticketId: string) {
  const res = await api<ApiResponse<UsageTicketRecord>>(`/usage/${encodeURIComponent(ticketId)}`);
  return res.data!;
}
