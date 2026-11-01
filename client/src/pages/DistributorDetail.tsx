import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getDistributor } from '../api/distributors';
import { listInventory, type InventoryFilters } from '../api/inventory';
import { getExportUrl } from '../api/reports';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { HelpBanner } from '../components/HelpBanner';
import { SearchBar } from '../components/SearchBar';
import { SortableTh } from '../components/SortableTh';

export default function DistributorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Server-side paging + sorting so the page shows ALL of a distributor's items,
  // not just the first 100 (mirrors the main Inventory page).
  const [filters, setFilters] = useState<InventoryFilters>({
    page: 1,
    limit: 100,
    distributorId: id,
    sortBy: 'productLabel',
    sortDir: 'asc',
  });
  // Search box text (committed to filters on Enter — server-side, scoped to this
  // distributor, mirroring the Inventory page).
  const [search, setSearch] = useState('');

  const { data: distributor } = useQuery({
    queryKey: ['distributor', id],
    queryFn: () => getDistributor(id!),
    enabled: !!id,
  });

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', filters],
    queryFn: () => listInventory(filters),
    enabled: !!id,
  });

  const items = inventoryData?.data ?? [];
  const meta = inventoryData?.meta;
  const totalItems = meta?.total ?? items.length;
  const totalPages = meta ? Math.ceil(meta.total! / meta.limit!) : 1;

  function toggleSort(key: string) {
    setFilters((prev) =>
      prev.sortBy === key
        ? { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc', page: 1 }
        : { ...prev, sortBy: key, sortDir: 'asc', page: 1 },
    );
  }

  async function handleShare() {
    if (!distributor) return;
    const url = getExportUrl({ distributorId: id! });
    const fullUrl = window.location.origin + url;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${distributor.name} Inventory`,
          text: `Inventory report for ${distributor.name} (${totalItems} items)`,
          url: fullUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(fullUrl);
      alert('Export link copied to clipboard');
    }
  }

  if (!distributor) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back
      </button>

      <HelpBanner storageKey="distributor-detail">
        This distributor's assigned stock. Use the search box to find an item by item number, lot, or product, tap a column header to sort, or Download Excel for a full export.
      </HelpBanner>

      {/* Distributor info */}
      <div className="rounded-2xl bg-white p-5 shadow-sm mb-4">
        <h2 className="text-xl font-bold text-gray-900">{distributor.name}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {distributor.region && (
            <div>
              <span className="text-sm text-gray-500">Region</span>
              <p className="text-base text-gray-900">{distributor.region}</p>
            </div>
          )}
          {distributor.contact && (
            <div>
              <span className="text-sm text-gray-500">Contact</span>
              <p className="text-base text-gray-900">{distributor.contact}</p>
            </div>
          )}
          {distributor.email && (
            <div>
              <span className="text-sm text-gray-500">Email</span>
              <p className="text-base text-gray-900">{distributor.email}</p>
            </div>
          )}
          {distributor.phone && (
            <div>
              <span className="text-sm text-gray-500">Phone</span>
              <p className="text-base text-gray-900">{distributor.phone}</p>
            </div>
          )}
        </div>

        {/* Export / Share buttons */}
        <div className="mt-4 flex gap-3">
          <a
            href={getExportUrl({ distributorId: id! })}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            <Download size={20} />
            Download Excel
          </a>
          <button
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Share2 size={20} />
            Share
          </button>
        </div>
      </div>

      {/* Assigned items */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-gray-900">
          Assigned Items ({totalItems})
        </h3>

        <SearchBar
          className="mb-3"
          value={search}
          onChange={setSearch}
          onSubmit={() => setFilters((p) => ({ ...p, search: search.trim() || undefined, page: 1 }))}
          onClear={() => {
            setSearch('');
            setFilters((p) => ({ ...p, search: undefined, page: 1 }));
          }}
          placeholder="Search item number, lot, or product..."
        />

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">
            {filters.search ? `No items match "${filters.search}"` : 'No items assigned to this distributor'}
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 lg:hidden">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/inventory/${encodeURIComponent(item.id)}`)}
                  className="cursor-pointer rounded-xl border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-base font-semibold text-gray-900">
                    {item.productLabel || 'Unknown Product'}
                  </p>
                  <p className="text-sm text-gray-600 font-mono">{item.itemNumber || '—'}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm text-gray-500">LOT: {item.lot}</span>
                    <ExpiryBadge expDate={item.expDate} showDate />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <SortableTh label="Product" sortKey="productLabel" currentKey={filters.sortBy || 'productLabel'} currentDir={filters.sortDir || 'asc'} onSort={toggleSort} className="px-3 py-2" />
                    <SortableTh label="Item Number" sortKey="itemNumber" currentKey={filters.sortBy || 'productLabel'} currentDir={filters.sortDir || 'asc'} onSort={toggleSort} className="px-3 py-2" />
                    <SortableTh label="LOT" sortKey="lot" currentKey={filters.sortBy || 'productLabel'} currentDir={filters.sortDir || 'asc'} onSort={toggleSort} className="px-3 py-2" />
                    <SortableTh label="Expiry" sortKey="expDate" currentKey={filters.sortBy || 'productLabel'} currentDir={filters.sortDir || 'asc'} onSort={toggleSort} className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/inventory/${encodeURIComponent(item.id)}`)}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-medium">{item.productLabel || 'Unknown'}</td>
                      <td className="px-3 py-2 font-mono">{item.itemNumber || '—'}</td>
                      <td className="px-3 py-2">{item.lot}</td>
                      <td className="px-3 py-2"><ExpiryBadge expDate={item.expDate} showDate /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
      </div>
    </div>
  );
}
