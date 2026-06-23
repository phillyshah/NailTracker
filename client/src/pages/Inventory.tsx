import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { Download, RefreshCw, ChevronLeft, ChevronRight, X, ScanLine } from 'lucide-react';
import { listInventory, reassignItem, type InventoryFilters } from '../api/inventory';
import { listDistributors } from '../api/distributors';
import { getExportUrl } from '../api/reports';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { SearchBar } from '../components/SearchBar';
import { SortableTh } from '../components/SortableTh';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { cn } from '../utils/cn';
import { Button } from '../components/Button';
import { HelpBanner } from '../components/HelpBanner';
import { filtersToSearchParams, searchParamsToFilters } from '../utils/inventoryUrl';
import type { InventoryItem } from '../types';

export default function Inventory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize from the URL so returning from an item detail (or a refresh)
  // restores the exact page/sort/search the user was on.
  const [filters, setFilters] = useState<InventoryFilters>(() =>
    searchParamsToFilters(searchParams),
  );
  const [search, setSearch] = useState(searchParams.get('search') || '');

  // Keep the URL in sync with the active filters (replace, so paging/sorting
  // doesn't pollute history) — this is what lets "Back to Inventory" return here.
  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
  }, [filters, setSearchParams]);
  const [showFilters, setShowFilters] = useState(false);
  const [reassigning, setReassigning] = useState<InventoryItem | null>(null);
  const [reassignDistId, setReassignDistId] = useState('');
  const [reassignNote, setReassignNote] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { data: distributors = [] } = useQuery({
    queryKey: ['distributors'],
    queryFn: listDistributors,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory', filters],
    queryFn: () => listInventory(filters),
  });

  const items = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total! / meta.limit!) : 1;

  const reassignMutation = useMutation({
    mutationFn: () =>
      reassignItem(reassigning!.id, reassignDistId || null, reassignNote || undefined),
    onSuccess: () => {
      addToast('Item reassigned', 'success');
      setReassigning(null);
      setReassignDistId('');
      setReassignNote('');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const bulkReassignMutation = useMutation({
    mutationFn: async () => {
      for (const id of selectedItems) {
        await reassignItem(id, reassignDistId || null, 'Bulk reassignment');
      }
    },
    onSuccess: () => {
      addToast(`${selectedItems.size} items reassigned`, 'success');
      setSelectedItems(new Set());
      setReassigning(null);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  function handleSearch() {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  }

  function toggleSort(key: string) {
    setFilters((prev) => {
      if (prev.sortBy === key) {
        return { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc', page: 1 };
      }
      return { ...prev, sortBy: key, sortDir: 'asc', page: 1 };
    });
  }

  const gtinLabel = filters.gtinShort
    ? items.find((i) => i.gtinShort === filters.gtinShort)?.itemNumber || filters.gtinShort
    : null;
  const distLabel = filters.distributorId
    ? distributors.find((d) => d.id === filters.distributorId)?.name
    : filters.unassigned ? 'Unassigned' : null;
  const specialFilterLabel = filters.gtinShort
    ? `Item: ${gtinLabel}${distLabel ? ` @ ${distLabel}` : ''}`
    : filters.unassigned
      ? 'Unassigned items'
      : filters.expired
        ? 'Expired items'
        : filters.expiringInDays
          ? `Expiring within ${filters.expiringInDays} days`
          : null;

  function clearSpecialFilter() {
    // The URL-sync effect mirrors this into the query string.
    setFilters((prev) => ({
      ...prev,
      gtinShort: undefined,
      search: undefined,
      unassigned: undefined,
      expired: undefined,
      expiringInDays: undefined,
      distributorId: undefined,
      page: 1,
    }));
    setSearch('');
  }

  function toggleSelect(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      // Auto-set reassign dropdown to current distributor if all selected share one
      const selectedList = items.filter((i) => next.has(i.id));
      const distIds = new Set(selectedList.map((i) => i.distributorId || ''));
      if (distIds.size === 1) {
        setReassignDistId([...distIds][0]);
      }

      return next;
    });
  }

  return (
    <div className="mx-auto max-w-4xl lg:max-w-7xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/scan')}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <ScanLine size={18} /> Scan
          </button>
          <button
            onClick={() => refetch()}
            className="rounded-xl border border-gray-300 p-2.5 text-gray-600 hover:bg-gray-100"
            aria-label="Refresh"
          >
            <RefreshCw size={20} />
          </button>
          <a
            href={getExportUrl(filters as Record<string, string>)}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </a>
        </div>
      </div>

      <HelpBanner storageKey="inventory">
        Browse all active inventory. Use the search bar to find items by item number, lot, or product name. Tap any column header to sort, the filter icon to narrow by distributor or expiry date, or any row for full details.
      </HelpBanner>

      {/* Search bar */}
      <SearchBar
        className="mb-3"
        value={search}
        onChange={setSearch}
        onSubmit={handleSearch}
        onClear={() => {
          setSearch('');
          setFilters((prev) => ({ ...prev, search: undefined, page: 1 }));
        }}
        placeholder="Search item number, lot, or product..."
        showFilterButton
        filterActive={showFilters}
        onToggleFilter={() => setShowFilters(!showFilters)}
      />

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Distributor</span>
              <select
                value={filters.distributorId || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, distributorId: e.target.value || undefined, page: 1 }))
                }
                className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base bg-white focus:border-primary-500 focus:outline-none"
              >
                <option value="">All</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Expiring before</span>
              <input
                type="date"
                value={filters.expBefore || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, expBefore: e.target.value || undefined, page: 1 }))
                }
                className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:border-primary-500 focus:outline-none"
              />
            </label>
          </div>
        </div>
      )}

      {/* Active special filter indicator */}
      {specialFilterLabel && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-200 px-3 py-2">
          <span className="text-sm font-medium text-primary-800">
            Filtered: {specialFilterLabel}
          </span>
          <button
            onClick={clearSpecialFilter}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
            aria-label="Clear filter"
          >
            <X size={14} /> Clear
          </button>
        </div>
      )}

      {/* Bulk actions */}
      {selectedItems.size > 0 && (
        <div className="mb-3 rounded-2xl bg-primary-50 border-2 border-primary-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary-700">
              {selectedItems.size} selected
            </span>
            <button
              onClick={() => setSelectedItems(new Set())}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={reassignDistId}
              onChange={(e) => setReassignDistId(e.target.value)}
              className="flex-1 min-w-0 rounded-xl border border-primary-300 px-3 py-2.5 text-sm bg-white focus:outline-none"
            >
              <option value="">Unassigned</option>
              {distributors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => bulkReassignMutation.mutate()}
              disabled={bulkReassignMutation.isPending}
            >
              Reassign
            </Button>
          </div>
        </div>
      )}

      {/* Items list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg text-gray-500">No items found</p>
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="space-y-2 lg:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'rounded-2xl bg-white p-4 shadow-sm border-2 transition-colors',
                  selectedItems.has(item.id) ? 'border-primary-400' : 'border-transparent',
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/inventory/${encodeURIComponent(item.id)}`)}
                  >
                    <p className="text-base font-semibold text-gray-900">
                      {item.productLabel || 'Unknown Product'}
                    </p>
                    <p className="text-sm text-gray-600 font-mono truncate">{item.itemNumber || '—'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ExpiryBadge expDate={item.expDate} showDate />
                      <span className="text-sm text-gray-500">
                        {item.distributor?.name || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setReassigning(item);
                      setReassignDistId(item.distributorId || '');
                    }}
                    className="shrink-0 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Reassign
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-sm text-gray-500">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems(new Set(items.map((i) => i.id)));
                        } else {
                          setSelectedItems(new Set());
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th>
                  <SortableTh
                    label="Item Number"
                    sortKey="itemNumber"
                    currentKey={filters.sortBy || 'itemNumber'}
                    currentDir={filters.sortDir || 'asc'}
                    onSort={toggleSort}
                    className="px-4 py-3"
                  />
                  <SortableTh
                    label="Description"
                    sortKey="productLabel"
                    currentKey={filters.sortBy || 'itemNumber'}
                    currentDir={filters.sortDir || 'asc'}
                    onSort={toggleSort}
                    className="px-4 py-3"
                  />
                  <SortableTh
                    label="LOT"
                    sortKey="lot"
                    currentKey={filters.sortBy || 'itemNumber'}
                    currentDir={filters.sortDir || 'asc'}
                    onSort={toggleSort}
                    className="px-4 py-3"
                  />
                  <SortableTh
                    label="Expiry"
                    sortKey="expDate"
                    currentKey={filters.sortBy || 'itemNumber'}
                    currentDir={filters.sortDir || 'asc'}
                    onSort={toggleSort}
                    className="px-4 py-3"
                  />
                  <SortableTh
                    label="Distributor"
                    sortKey="distributor"
                    currentKey={filters.sortBy || 'itemNumber'}
                    currentDir={filters.sortDir || 'asc'}
                    onSort={toggleSort}
                    className="px-4 py-3"
                  />
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/inventory/${encodeURIComponent(item.id)}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{item.itemNumber || '—'}</td>
                    <td className="px-4 py-3 font-medium">{item.productLabel || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm">{item.lot}</td>
                    <td className="px-4 py-3"><ExpiryBadge expDate={item.expDate} showDate /></td>
                    <td className="px-4 py-3 text-sm">{item.distributor?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setReassigning(item);
                          setReassignDistId(item.distributorId || '');
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
                      >
                        Reassign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, (p.page || 1) - 1) }))}
                disabled={!meta || meta.page! <= 1}
                className="flex items-center gap-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-gray-100"
              >
                <ChevronLeft size={18} /> Prev
              </button>
              <span className="text-sm text-gray-600">
                Page {meta?.page} of {totalPages}
              </span>
              <button
                onClick={() => setFilters((p) => ({ ...p, page: Math.min(totalPages, (p.page || 1) + 1) }))}
                disabled={!meta || meta.page! >= totalPages}
                className="flex items-center gap-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-gray-100"
              >
                Next <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Reassign modal — full screen on mobile */}
      {reassigning && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Reassign Item</h3>
            <p className="text-sm text-gray-500 mb-4 font-mono">{reassigning.udi}</p>

            <label className="block mb-3">
              <span className="text-sm font-medium text-gray-700">New Distributor</span>
              <select
                value={reassignDistId}
                onChange={(e) => setReassignDistId(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:border-primary-500 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700">Note (optional)</span>
              <input
                type="text"
                value={reassignNote}
                onChange={(e) => setReassignNote(e.target.value)}
                placeholder="Reason for reassignment"
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
              />
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setReassigning(null);
                  setReassignNote('');
                }}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => reassignMutation.mutate()}
                disabled={reassignMutation.isPending}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {reassignMutation.isPending ? 'Saving...' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
