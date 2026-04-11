import { api } from './client';
import type { ApiResponse } from '../types';

export interface Bank {
  id: string;
  name: string;
  description: string | null;
  distributorId: string | null;
  distributor: { id: string; name: string } | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
  items?: any[];
}

export async function listBanks() {
  const res = await api<ApiResponse<Bank[]>>('/banks');
  return res.data!;
}

export async function getBank(id: string) {
  const res = await api<ApiResponse<Bank>>(`/banks/${id}`);
  return res.data!;
}

export async function createBank(data: { name: string; description?: string; distributorId?: string }) {
  const res = await api<ApiResponse<Bank>>('/banks', { method: 'POST', body: data });
  return res.data!;
}

export async function updateBank(id: string, data: { name?: string; description?: string; distributorId?: string }) {
  const res = await api<ApiResponse<Bank>>(`/banks/${id}`, { method: 'PATCH', body: data });
  return res.data!;
}

export async function deleteBank(id: string) {
  return api<ApiResponse<{ message: string }>>(`/banks/${id}`, { method: 'DELETE' });
}

export async function addItemsToBank(bankId: string, udis: string[]) {
  const res = await api<ApiResponse<{ updated: number }>>(`/banks/${bankId}/add`, { method: 'POST', body: { udis } });
  return res.data!;
}

export async function removeItemsFromBank(bankId: string, udis: string[]) {
  const res = await api<ApiResponse<{ updated: number }>>(`/banks/${bankId}/remove`, { method: 'POST', body: { udis } });
  return res.data!;
}

export async function transferBankToDistributor(bankId: string, distributorId: string, note?: string) {
  const res = await api<ApiResponse<{ transferred: number }>>(`/banks/${bankId}/transfer`, { method: 'POST', body: { distributorId, note } });
  return res.data!;
}
