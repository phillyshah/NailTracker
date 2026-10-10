import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * listAllInventory must page through the server's 100-row cap and return the
 * COMPLETE set — the selection lists (Transfer pick-mode, bank picker) depend
 * on this so they never silently show only the first 100 of thousands.
 */
const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('./client', () => ({ api: apiMock }));

import { listAllInventory } from './inventory';

beforeEach(() => vi.clearAllMocks());

/** Build a fake paged response of `total` items, 100 per page. */
function pagedResponder(total: number) {
  return (_path: string, opts?: { params?: Record<string, number> }) => {
    const page = opts?.params?.page ?? 1;
    const limit = opts?.params?.limit ?? 100;
    const start = (page - 1) * limit;
    const data = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => ({
      id: `item-${start + i}`,
    }));
    return Promise.resolve({ success: true, data, meta: { page, limit, total } });
  };
}

describe('listAllInventory', () => {
  it('returns all items across multiple pages (250 → 3 requests)', async () => {
    apiMock.mockImplementation(pagedResponder(250));
    const all = await listAllInventory({ distributorId: 'd1' });
    expect(all).toHaveLength(250);
    expect(apiMock).toHaveBeenCalledTimes(3); // pages 1, 2, 3
    // IDs are unique and complete (no dropped/duplicated rows).
    expect(new Set(all.map((i) => i.id)).size).toBe(250);
  });

  it('makes a single request when everything fits on one page', async () => {
    apiMock.mockImplementation(pagedResponder(42));
    const all = await listAllInventory({ distributorId: 'd1' });
    expect(all).toHaveLength(42);
    expect(apiMock).toHaveBeenCalledTimes(1);
  });

  it('handles an empty result', async () => {
    apiMock.mockImplementation(pagedResponder(0));
    const all = await listAllInventory({ distributorId: 'd1' });
    expect(all).toEqual([]);
    expect(apiMock).toHaveBeenCalledTimes(1);
  });

  it('forwards filters (e.g. distributorId) on every page request', async () => {
    apiMock.mockImplementation(pagedResponder(150));
    await listAllInventory({ distributorId: 'dX' });
    for (const call of apiMock.mock.calls) {
      expect(call[1].params.distributorId).toBe('dX');
      expect(call[1].params.limit).toBe(100);
    }
  });
});
