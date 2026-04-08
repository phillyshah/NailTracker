import { api } from './client';
import type { ApiResponse } from '../types';

interface LoginData {
  token: string;
  user: { id: string; username: string; role: string };
}

export async function login(username: string, password: string) {
  const res = await api<ApiResponse<LoginData>>('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  if (res.data?.token) {
    localStorage.setItem('token', res.data.token);
  }
  return res.data!;
}

export async function logout() {
  await api<ApiResponse<null>>('/auth/logout', { method: 'POST' });
  localStorage.removeItem('token');
}

export async function getMe() {
  const res = await api<ApiResponse<{ userId: string; username: string; role: string }>>('/auth/me');
  return res.data!;
}
