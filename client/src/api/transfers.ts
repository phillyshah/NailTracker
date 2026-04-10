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
