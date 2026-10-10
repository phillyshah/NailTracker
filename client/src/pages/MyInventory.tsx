import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package } from 'lucide-react';
import { listMyInventory } from '../api/inventory';
import { SearchBar } from '../components/SearchBar';
import { ExpiryBadge } from '../components/ExpiryBadge';
import { useAuth } from '../context/AuthContext';

export default function MyInventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-inventory', search],
    queryFn: () => listMyInventory({ search, limit: 100, sortBy: 'itemNumber', sortDir: 'asc' }),
  });

  const items = data?.data ?? [];
  const total = data?.meta?.total ?? items.length;

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      {user?.role === 'distributor' && (
        <button
          onClick={() => navigate('/home')}
          className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={20} /> Back to Home
        </button>
      )}

      <div className="mb-3 flex items-center gap-2">
        <Package size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">My Inventory</h2>
      </div>

      <div className="mb-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search item number, lot, or product..." />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <Package size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base text-gray-500">
            {search ? 'No items match your search.' : 'You have no inventory assigned.'}
          </p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-400">
            {total} item{total === 1 ? '' : 's'} on hand
          </p>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <span className="block font-mono text-xs font-semibold text-gray-900">
                        {it.itemNumber || '—'}
                      </span>
                      <span className="block truncate text-xs text-gray-500">{it.productLabel}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-500">Lot {it.lot}</td>
                    <td className="px-4 py-3 text-right">
                      <ExpiryBadge expDate={it.expDate} showDate />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
