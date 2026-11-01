import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * End-to-end deduction test: drives the REAL preview, commit, and inventory
 * `list` controllers against a stateful in-memory store (no mocked return
 * values — the fake actually filters and mutates), proving that consuming an
 * item via a usage ticket removes it from the distributor's main inventory and
 * count, leaves other distributors untouched, and can't be double-deducted.
 */

interface Item {
  id: string;
  udi: string;
  gtin: string;
  gtinShort: string;
  lot: string;
  expDate: Date | null;
  rawBarcode: string;
  productLabel: string | null;
  distributorId: string | null;
  usedAt: Date | null;
  usageTicketId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
}

const { store, prismaMock } = vi.hoisted(() => {
  const store = {
    items: [] as any[],
    history: [] as any[],
    tickets: [] as any[],
    distributors: [] as any[],
  };

  // Honour only the where-keys these controllers actually use.
  function matches(item: any, where: any): boolean {
    if (!where) return true;
    for (const [key, cond] of Object.entries<any>(where)) {
      if (key === 'id') {
        if (cond && typeof cond === 'object' && 'in' in cond) {
          if (!cond.in.includes(item.id)) return false;
        } else if (item.id !== cond) return false;
      } else if (key === 'usedAt') {
        // we only ever query usedAt: null
        if (cond === null && item.usedAt != null) return false;
      } else if (key === 'deletedAt') {
        if (cond === null && item.deletedAt != null) return false;
      } else if (key === 'distributorId') {
        if (item.distributorId !== cond) return false;
      } else if (key === 'gtinShort' || key === 'lot') {
        if (item[key] !== cond) return false;
      }
      // ignore orderBy/OR/expDate etc. — not used by these tests
    }
    return true;
  }

  const prismaMock = {
    distributor: {
      findUnique: async ({ where }: any) =>
        store.distributors.find((d) => d.id === where.id) ?? null,
    },
    inventoryItem: {
      findMany: async ({ where }: any) =>
        store.items
          .filter((i) => matches(i, where))
          .map((i) => ({
            ...i,
            distributor: store.distributors.find((d) => d.id === i.distributorId) ?? null,
          })),
      count: async ({ where }: any) => store.items.filter((i) => matches(i, where)).length,
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const i of store.items) {
          if (matches(i, where)) {
            Object.assign(i, data);
            count++;
          }
        }
        return { count };
      },
    },
    assignmentHistory: {
      create: async ({ data }: any) => {
        store.history.push(data);
        return data;
      },
    },
    usageTicket: {
      findFirst: async ({ where }: any) => {
        const prefix = where?.ticketId?.startsWith ?? '';
        const matching = store.tickets
          .filter((t) => t.ticketId.startsWith(prefix))
          .sort((a, b) => (a.ticketId < b.ticketId ? 1 : -1));
        return matching[0] ?? null;
      },
      create: async ({ data }: any) => {
        store.tickets.push(data);
        return data;
      },
    },
    $transaction: async (ops: any[]) => Promise.all(ops),
  };

  return { store, prismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: prismaMock }));

import { preview, commit } from './usage.controller.js';
import { list } from './inventory.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

async function run(
  fn: (req: any, res: any) => Promise<unknown>,
  opts: { body?: any; query?: any } = {},
) {
  const req = { params: {}, query: opts.query ?? {}, body: opts.body ?? {}, user: { username: 'tester' } };
  const res = makeRes();
  await fn(req, res);
  return res.json.mock.calls[0][0];
}

/** Count an active distributor's available stock via the REAL inventory list controller. */
async function distributorCount(distributorId: string): Promise<number> {
  const out = await run(list, { query: { distributorId } });
  return out.meta.total;
}

const BARCODE = '(01)08800089459032(10)J251021-L009(17)301020'; // gtinShort 9459032, lot J251021-L009

function seedUnit(id: string, distributorId: string, expDate: string, createdAt: string): Item {
  return {
    id,
    udi: `9459032-J251021-L009`,
    gtin: '08800089459032',
    gtinShort: '9459032',
    lot: 'J251021-L009',
    expDate: new Date(expDate),
    rawBarcode: BARCODE,
    productLabel: 'Interlocking Screw 32 x Ø5 mm',
    distributorId,
    usedAt: null,
    usageTicketId: null,
    deletedAt: null,
    createdAt: new Date(createdAt),
  };
}

beforeEach(() => {
  store.history.length = 0;
  store.tickets.length = 0;
  store.distributors.length = 0;
  store.items.length = 0;
  store.distributors.push(
    { id: 'dist1', name: 'Acme Ortho', active: true },
    { id: 'dist2', name: 'Other Distributor', active: true },
  );
});

describe('usage consumption deducts from distributor inventory (integration)', () => {
  it('removes exactly the consumed unit from the distributor count and list, leaving others', async () => {
    store.items.push(
      seedUnit('u-late', 'dist1', '2032-01-01', '2026-01-01'),
      seedUnit('u-early', 'dist1', '2030-06-01', '2026-01-01'), // oldest expiry → FIFO pick
      seedUnit('u-mid', 'dist1', '2031-01-01', '2026-01-01'),
      seedUnit('d2-unit', 'dist2', '2030-06-01', '2026-01-01'), // different distributor
    );

    // Before: dist1 has 3 available, dist2 has 1.
    expect(await distributorCount('dist1')).toBe(3);
    expect(await distributorCount('dist2')).toBe(1);

    // Preview picks the oldest-expiry unit.
    const pv = await run(preview, { body: { distributorId: 'dist1', barcodes: [BARCODE] } });
    expect(pv.data.lines[0].status).toBe('available');
    expect(pv.data.lines[0].matchedItemId).toBe('u-early');

    // Commit consumes it.
    const cm = await run(commit, { body: { distributorId: 'dist1', itemIds: ['u-early'] } });
    expect(cm.data.consumed).toBe(1);
    expect(cm.data.ticketId).toMatch(/^USE-\d{8}-0001$/);

    // After: dist1 dropped to 2, the consumed unit is gone, dist2 untouched.
    expect(await distributorCount('dist1')).toBe(2);
    const list1 = await run(list, { query: { distributorId: 'dist1' } });
    expect(list1.data.map((i: any) => i.id)).not.toContain('u-early');
    expect(list1.data.map((i: any) => i.id).sort()).toEqual(['u-late', 'u-mid']);
    expect(await distributorCount('dist2')).toBe(1);

    // The consumed unit kept its distributor but is now stamped used + ticketed.
    const consumed = store.items.find((i) => i.id === 'u-early')!;
    expect(consumed.usedAt).toBeInstanceOf(Date);
    expect(consumed.usageTicketId).toBe(cm.data.ticketId);
    expect(consumed.distributorId).toBe('dist1');

    // Audit + grouped ticket were written.
    expect(store.history).toHaveLength(1);
    expect(store.history[0].note).toContain(cm.data.ticketId);
    expect(store.history[0].fromDistributorName).toBe('Acme Ortho');
    expect(store.tickets).toHaveLength(1);
    expect(store.tickets[0].itemCount).toBe(1);
    expect(store.tickets[0].items[0].id).toBe('u-early');
  });

  it('never deducts more than is in stock and cannot double-consume the same unit', async () => {
    store.items.push(seedUnit('only', 'dist1', '2030-06-01', '2026-01-01'));
    expect(await distributorCount('dist1')).toBe(1);

    // Two identical stickers, only one unit: 1st available, 2nd not_in_stock.
    const pv = await run(preview, { body: { distributorId: 'dist1', barcodes: [BARCODE, BARCODE] } });
    expect(pv.data.lines[0].status).toBe('available');
    expect(pv.data.lines[1].status).toBe('not_in_stock');

    // Consume the one unit → stock hits 0.
    const cm = await run(commit, { body: { distributorId: 'dist1', itemIds: ['only'] } });
    expect(cm.data.consumed).toBe(1);
    expect(await distributorCount('dist1')).toBe(0);

    // Trying to consume it again is blocked (already used) and changes nothing.
    const res = makeRes();
    await commit(
      { params: {}, query: {}, body: { distributorId: 'dist1', itemIds: ['only'] }, user: { username: 'tester' } } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(await distributorCount('dist1')).toBe(0);
    expect(store.tickets).toHaveLength(1); // no second ticket created
  });

  it('blocks consuming a unit that belongs to a different distributor', async () => {
    store.items.push(seedUnit('d2-unit', 'dist2', '2030-06-01', '2026-01-01'));

    // dist1 sees it as not in stock.
    const pv = await run(preview, { body: { distributorId: 'dist1', barcodes: [BARCODE] } });
    expect(pv.data.lines[0].status).toBe('not_in_stock');

    // Even if the id is sent directly, commit refuses (wrong distributor).
    const res = makeRes();
    await commit(
      { params: {}, query: {}, body: { distributorId: 'dist1', itemIds: ['d2-unit'] }, user: { username: 'tester' } } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(await distributorCount('dist2')).toBe(1); // dist2 untouched
  });
});
