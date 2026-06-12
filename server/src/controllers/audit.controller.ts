import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { parseGS1, isParseError } from '../utils/parseGS1.js';
import { getItemNumber, getProductLabel } from '../utils/gtin-map.js';
import { reconcile, type ScanInput, type ExtraRow } from '../utils/auditReconcile.js';

/**
 * Cycle Count / Physical Audit.
 *
 * Two-phase, mirroring Usage:
 *  - preview: parse the scanned shelf, reconcile against the distributor's
 *    available stock into matched / missing / extra. No mutation.
 *  - commit: apply one-tap fixes (create extras as new stock; soft-delete the
 *    missing units) and save an AuditSession snapshot, all in one transaction.
 */

/** Generate the next AUD-YYYYMMDD-NNNN id (sequential per day). */
export async function generateAuditId(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `AUD-${dateStr}`;
  const last = await prisma.auditSession.findFirst({
    where: { auditId: { startsWith: prefix } },
    orderBy: { auditId: 'desc' },
  });
  let seq = 1;
  if (last) seq = parseInt(last.auditId.split('-').pop() || '0', 10) + 1;
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/** POST /api/audits/preview — { distributorId, barcodes[] } → reconciliation. */
export async function preview(req: Request, res: Response) {
  try {
    const { distributorId, barcodes } = req.body as { distributorId: string; barcodes: string[] };
    const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
    if (!distributor) return error(res, 'Distributor not found', 404);

    const scans: ScanInput[] = [];
    const errors: { barcode: string; errorMessage: string }[] = [];
    (barcodes || []).forEach((barcode, idx) => {
      const parsed = parseGS1(barcode);
      if (isParseError(parsed)) {
        errors.push({ barcode, errorMessage: parsed.error });
        return;
      }
      scans.push({
        key: `scan-${idx}`,
        gtinShort: parsed.gtinShort,
        lot: parsed.lot,
        gtin: parsed.gtin,
        itemNumber: getItemNumber(parsed.gtinShort, parsed.rawBarcode),
        productLabel: parsed.productLabel || getProductLabel(parsed.gtinShort, parsed.rawBarcode),
        expDate: parsed.expDate?.toISOString() ?? null,
        udi: parsed.udi,
        rawBarcode: parsed.rawBarcode,
      });
    });

    const stock = await prisma.inventoryItem.findMany({
      where: { distributorId, usedAt: null, deletedAt: null },
      select: {
        id: true,
        gtinShort: true,
        rawBarcode: true,
        lot: true,
        productLabel: true,
        expDate: true,
        createdAt: true,
      },
    });

    const result = reconcile(
      scans,
      stock.map((s) => ({
        id: s.id,
        gtinShort: s.gtinShort,
        lot: s.lot,
        itemNumber: getItemNumber(s.gtinShort, s.rawBarcode),
        productLabel: s.productLabel,
        expDate: s.expDate,
        createdAt: s.createdAt,
      })),
    );

    return success(res, {
      distributorId,
      distributorName: distributor.name,
      ...result,
      errors,
      counts: {
        matched: result.matched.length,
        missing: result.missing.length,
        extra: result.extra.length,
      },
    });
  } catch (err) {
    return error(res, 'Failed to preview audit', 500);
  }
}

interface CommitBody {
  distributorId: string;
  matchedCount?: number;
  extras?: ExtraRow[]; // scanned units to ADD as new stock at the distributor
  missingItemIds?: string[]; // system units to flag as not-found (soft-delete)
  note?: string;
}

/** POST /api/audits/commit — apply resolutions + save the audit record. */
export async function commit(req: Request, res: Response) {
  try {
    const { distributorId, matchedCount = 0, extras = [], missingItemIds = [], note } =
      req.body as CommitBody;

    const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
    if (!distributor) return error(res, 'Distributor not found', 404);

    const username = req.user?.username || null;
    const now = new Date();
    const auditId = await generateAuditId();

    // Re-scope missing soft-deletes to units actually still here, so a unit
    // moved/used between preview and commit isn't wrongly removed.
    const missingToRemove = missingItemIds.length
      ? await prisma.inventoryItem.findMany({
          where: { id: { in: missingItemIds }, distributorId, usedAt: null, deletedAt: null },
          select: { id: true, distributorId: true },
        })
      : [];

    const snapshot = {
      extrasAdded: extras.map((e) => ({
        itemNumber: e.itemNumber,
        productLabel: e.productLabel,
        lot: e.lot,
        gtin: e.gtin,
        gtinShort: e.gtinShort,
        expDate: e.expDate,
      })),
      missingRemoved: missingToRemove.map((m) => m.id),
      matchedCount,
    };

    const ops = [];

    // 1) Create each extra as new stock at the distributor + an assignment row.
    for (const e of extras) {
      ops.push(
        prisma.inventoryItem.create({
          data: {
            udi: e.udi || `${e.gtinShort}-${e.lot}`,
            gtin: e.gtin || '',
            gtinShort: e.gtinShort,
            lot: e.lot,
            expDate: e.expDate ? new Date(e.expDate) : null,
            rawBarcode: e.rawBarcode || e.udi || `${e.gtinShort}-${e.lot}`,
            productLabel: e.productLabel || null,
            distributorId,
            assignedAt: now,
            assignedBy: username,
            history: {
              create: {
                toDistributorId: distributorId,
                toDistributorName: distributor.name,
                changedBy: username,
                note: `Added via cycle count ${auditId}`,
              },
            },
          },
        }),
      );
    }

    // 2) Soft-delete the missing units + history note.
    for (const m of missingToRemove) {
      ops.push(
        prisma.inventoryItem.update({
          where: { id: m.id },
          data: { deletedAt: now },
        }),
        prisma.assignmentHistory.create({
          data: {
            itemId: m.id,
            fromDistributorId: m.distributorId,
            fromDistributorName: distributor.name,
            changedBy: username,
            note: `Removed via cycle count ${auditId} — not found on shelf`,
          },
        }),
      );
    }

    // 3) The audit record itself.
    ops.push(
      prisma.auditSession.create({
        data: {
          auditId,
          distributorId,
          distributorName: distributor.name,
          matchedCount,
          missingCount: missingToRemove.length,
          extraCount: extras.length,
          items: snapshot,
          note: note || null,
          createdBy: username,
        },
      }),
    );

    await prisma.$transaction(ops);

    return success(res, {
      auditId,
      added: extras.length,
      removed: missingToRemove.length,
      matchedCount,
    });
  } catch (err) {
    return error(res, 'Failed to commit audit', 500);
  }
}

/** GET /api/audits — list past audit sessions, newest first. */
export async function list(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(str(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(str(req.query.limit)) || 25));
    const [sessions, total] = await Promise.all([
      prisma.auditSession.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditSession.count(),
    ]);
    return success(res, sessions, { page, limit, total });
  } catch (err) {
    return error(res, 'Failed to fetch audits', 500);
  }
}
