import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { deriveAliases, type CorrectedLabel } from '../utils/ocrTraining.js';

// OCR Training (TrackerLabs, admin-only). Collects label photos + the matcher's
// guess, lets admins confirm/correct them, and turns confirmed corrections into
// OcrAlias rows the client matcher loads at boot.

const SAMPLE_SELECT = {
  id: true,
  rawText: true,
  parsedJson: true,
  correctedJson: true,
  status: true,
  createdBy: true,
  createdAt: true,
} as const;

/** GET /api/ocr-training?status=pending — newest first (image bytes omitted). */
export async function listSamples(req: Request, res: Response) {
  try {
    const status = str(req.query.status);
    const samples = await prisma.ocrTrainingSample.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: SAMPLE_SELECT,
    });
    return success(res, samples);
  } catch {
    return error(res, 'Failed to list training samples', 500);
  }
}

/** GET /api/ocr-training/:id — full sample including the stored image. */
export async function getSample(req: Request, res: Response) {
  try {
    const sample = await prisma.ocrTrainingSample.findUnique({
      where: { id: str(req.params.id) },
    });
    if (!sample) return error(res, 'Sample not found', 404);
    return success(res, sample);
  } catch {
    return error(res, 'Failed to load sample', 500);
  }
}

/** POST /api/ocr-training — store one uploaded label + the matcher's guess. */
export async function createSample(req: Request, res: Response) {
  try {
    const { imageData, rawText, parsedJson } = req.body ?? {};
    if (typeof imageData !== 'string' || typeof rawText !== 'string') {
      return error(res, 'imageData and rawText are required', 400);
    }
    const sample = await prisma.ocrTrainingSample.create({
      data: {
        imageData,
        rawText,
        parsedJson: parsedJson ?? [],
        status: 'pending',
        createdBy: req.user?.username ?? null,
      },
      select: SAMPLE_SELECT,
    });
    return success(res, sample, undefined, 201);
  } catch {
    return error(res, 'Failed to save training sample', 500);
  }
}

/**
 * PATCH /api/ocr-training/:id — save the admin's review. When the sample is
 * confirmed or corrected, derive aliases from the corrected labels and upsert
 * them so the matcher can learn from this label going forward.
 */
export async function updateSample(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { correctedJson, status } = req.body ?? {};
    const validStatus = ['pending', 'confirmed', 'corrected', 'rejected'];
    if (status && !validStatus.includes(status)) {
      return error(res, 'Invalid status', 400);
    }

    const sample = await prisma.ocrTrainingSample.update({
      where: { id },
      data: {
        ...(correctedJson !== undefined ? { correctedJson } : {}),
        ...(status ? { status } : {}),
      },
      select: SAMPLE_SELECT,
    });

    let aliasesAdded = 0;
    if ((status === 'confirmed' || status === 'corrected') && Array.isArray(correctedJson)) {
      const aliases = deriveAliases(correctedJson as CorrectedLabel[]);
      for (const a of aliases) {
        await prisma.ocrAlias.upsert({
          where: { token: a.token },
          create: { token: a.token, canonicalRef: a.canonicalRef, source: 'training' },
          update: { canonicalRef: a.canonicalRef },
        });
      }
      aliasesAdded = aliases.length;
    }

    return success(res, { sample, aliasesAdded });
  } catch {
    return error(res, 'Failed to update training sample', 500);
  }
}

/** DELETE /api/ocr-training/:id */
export async function deleteSample(req: Request, res: Response) {
  try {
    await prisma.ocrTrainingSample.delete({ where: { id: str(req.params.id) } });
    return success(res, { deleted: true });
  } catch {
    return error(res, 'Failed to delete sample', 500);
  }
}

/** GET /api/ocr-training/aliases — the alias overlay the client loads at boot. */
export async function listAliases(_req: Request, res: Response) {
  try {
    const aliases = await prisma.ocrAlias.findMany({
      orderBy: { createdAt: 'desc' },
      select: { token: true, canonicalRef: true },
    });
    return success(res, aliases);
  } catch {
    return error(res, 'Failed to list aliases', 500);
  }
}

/**
 * GET /api/ocr-training/export-fixtures — reviewed samples shaped for a Vitest
 * corpus: { rawText, expected: gs1[] }. Lets the dev grow the regression set.
 */
export async function exportFixtures(_req: Request, res: Response) {
  try {
    const samples = await prisma.ocrTrainingSample.findMany({
      where: { status: { in: ['confirmed', 'corrected'] } },
      orderBy: { createdAt: 'asc' },
      select: { rawText: true, parsedJson: true, correctedJson: true },
    });
    const fixtures = samples.map((s) => {
      const labels = (s.correctedJson ?? s.parsedJson) as { gs1?: string }[] | null;
      const expected = Array.isArray(labels)
        ? labels.map((l) => l.gs1).filter((g): g is string => typeof g === 'string')
        : [];
      return { rawText: s.rawText, expected };
    });
    return success(res, fixtures);
  } catch {
    return error(res, 'Failed to export fixtures', 500);
  }
}
