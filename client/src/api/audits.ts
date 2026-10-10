import { api } from './client';
import type { ApiResponse } from '../types';

export interface AuditMatched {
  scanKey: string;
  itemId: string;
  itemNumber: string | null;
  productLabel: string;
  lot: string;
  expDate: string | null;
}

export interface AuditExtra {
  scanKey: string;
  gtinShort: string;
  lot: string;
  itemNumber: string | null;
  productLabel: string;
  gtin: string | null;
  expDate: string | null;
  udi: string | null;
  rawBarcode: string | null;
}

export interface AuditMissing {
  itemId: string;
  gtinShort: string;
  lot: string;
  itemNumber: string | null;
  productLabel: string;
  expDate: string | null;
}

export interface AuditPreview {
  distributorId: string;
  distributorName: string;
  matched: AuditMatched[];
  extra: AuditExtra[];
  missing: AuditMissing[];
  errors: { barcode: string; errorMessage: string }[];
  counts: { matched: number; missing: number; extra: number };
}

export interface AuditCommitResult {
  auditId: string;
  added: number;
  removed: number;
  matchedCount: number;
}

export interface AuditSession {
  id: string;
  auditId: string;
  distributorId: string | null;
  distributorName: string;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export async function previewAudit(distributorId: string, barcodes: string[]) {
  const res = await api<ApiResponse<AuditPreview>>('/audits/preview', {
    method: 'POST',
    body: { distributorId, barcodes },
  });
  return res.data!;
}

export async function commitAudit(input: {
  distributorId: string;
  matchedCount: number;
  extras: AuditExtra[];
  missingItemIds: string[];
  note?: string;
}) {
  const res = await api<ApiResponse<AuditCommitResult>>('/audits/commit', {
    method: 'POST',
    body: input,
  });
  return res.data!;
}

export async function listAudits() {
  const res = await api<ApiResponse<AuditSession[]>>('/audits');
  return res.data!;
}
