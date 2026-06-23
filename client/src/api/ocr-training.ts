import { api } from './client';
import type { ApiResponse } from '../types';

/** One label within a sample's parsed / corrected guess. */
export interface TrainingLabel {
  token?: string;
  ref?: string;
  gtin?: string;
  lot?: string;
  exp?: string | null;
  gs1?: string;
}

export type SampleStatus = 'pending' | 'confirmed' | 'corrected' | 'rejected';

export interface TrainingSample {
  id: string;
  rawText: string;
  parsedJson: TrainingLabel[];
  correctedJson: TrainingLabel[] | null;
  status: SampleStatus;
  createdBy: string | null;
  createdAt: string;
}

export interface OcrAlias {
  token: string;
  canonicalRef: string;
}

export async function listSamples(status?: SampleStatus) {
  const res = await api<ApiResponse<TrainingSample[]>>('/ocr-training', {
    params: { status },
  });
  return res.data!;
}

export async function createSample(input: {
  imageData: string;
  rawText: string;
  parsedJson: TrainingLabel[];
}) {
  const res = await api<ApiResponse<TrainingSample>>('/ocr-training', {
    method: 'POST',
    body: input,
  });
  return res.data!;
}

export async function updateSample(
  id: string,
  input: { correctedJson?: TrainingLabel[]; status: SampleStatus },
) {
  const res = await api<ApiResponse<{ sample: TrainingSample; aliasesAdded: number }>>(
    `/ocr-training/${id}`,
    { method: 'PATCH', body: input },
  );
  return res.data!;
}

export async function deleteSample(id: string) {
  await api<ApiResponse<{ deleted: boolean }>>(`/ocr-training/${id}`, { method: 'DELETE' });
}

export async function listAliases() {
  const res = await api<ApiResponse<OcrAlias[]>>('/ocr-training/aliases');
  return res.data!;
}
