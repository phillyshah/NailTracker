import { api } from './client';
import type { ApiResponse, Distributor } from '../types';

export async function listDistributors() {
  const res = await api<ApiResponse<Distributor[]>>('/distributors');
  return res.data!;
}

export async function getDistributor(id: string) {
  const res = await api<ApiResponse<Distributor>>(`/distributors/${id}`);
  return res.data!;
}

export async function createDistributor(data: Partial<Distributor>) {
  const res = await api<ApiResponse<Distributor>>('/distributors', {
    method: 'POST',
    body: data,
  });
  return res.data!;
}

export async function updateDistributor(id: string, data: Partial<Distributor>) {
  const res = await api<ApiResponse<Distributor>>(`/distributors/${id}`, {
    method: 'PATCH',
    body: data,
  });
  return res.data!;
}

export async function deactivateDistributor(id: string) {
  return api<ApiResponse<{ message: string; assignedItems: number; warning?: string }>>(`/distributors/${id}`, {
    method: 'DELETE',
  });
}
