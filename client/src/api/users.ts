import { api } from './client';
import type { ApiResponse } from '../types';

export interface User {
  id: string;
  username: string;
  role: string;
  createdAt: string;
}

export async function listUsers() {
  const res = await api<ApiResponse<User[]>>('/users');
  return res.data!;
}

export async function createUser(username: string, password: string, role: string) {
  const res = await api<ApiResponse<User>>('/users', {
    method: 'POST',
    body: { username, password, role },
  });
  return res.data!;
}

export async function updatePassword(id: string, password: string) {
  return api<ApiResponse<{ message: string }>>(`/users/${id}/password`, {
    method: 'PATCH',
    body: { password },
  });
}

export async function updateRole(id: string, role: string) {
  const res = await api<ApiResponse<User>>(`/users/${id}/role`, {
    method: 'PATCH',
    body: { role },
  });
  return res.data!;
}

export async function deleteUser(id: string) {
  return api<ApiResponse<{ message: string }>>(`/users/${id}`, {
    method: 'DELETE',
  });
}
