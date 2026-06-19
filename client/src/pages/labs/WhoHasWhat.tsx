import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { getHoldings, getHoldingsExportUrl } from '../../api/holdings';
import { matchesItemSearch } from '../../utils/itemSearch';
import { HelpBanner } from '../../components/HelpBanner';
import { SearchBar } from '../../components/SearchBar';

type Mode = 'current' | 'asof';

export default function WhoHasWhat() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('current');
  const [asOf, setAsOf] = useState('');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Only send asOf when in point-in-time mode with a date chosen.
  const activeAsOf = mode === 'asof' && asOf ? asOf : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['holdings', activeAsOf ?? 'current'],
    queryFn: () => getHoldings({ asOf: activeAsOf }),
  });

  const groups = useMemo(() => {
    const raw = data?.groups ?? [];
    if (!search) return raw;
    return raw
      .map((g) => ({
        ...g,
        items: g.items.filter((it) =>
          matchesItemSearch(
            { itemNumber: it.itemNumber ?? '', productLabel: it.productLabel ?? '', gtinShort: '' },
            search,
          ),
        ),
      }))
      .map((g) => ({ ...g, count: g.items.length }))
      .filter((g) => g.items.length > 0);
  }, [data, search]);

  const waitingForDate = mode === 'asof' && !asOf;

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <button
        onClick={() => navigate('/labs')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to TrackerLabs
      </button>

      <div className="mb-2 flex items-center gap-2">
        <Users size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">Who Has What</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">
          Beta
        </span>
      </div>

      <HelpBanner storageKey="who-has-what">
        See who holds each item, grouped by distributor. Switch to{' '}
        <strong>As of a date</strong> to reconstruct holdings at a point in the
        past from movement history.
      </HelpBanner>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-gray-300 bg-white p-0.5">
          <button
            onClick={() => setMode('current')}
            className={
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ' +
              (mode === 'current' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')
            }
          >
            Current
          </button>
          <button
            onClick={() => setMode('asof')}
            className={
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ' +
              (mode === 'asof' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')
            }
          >
            As of a date
          </button>
        </div>

        {mode === 'asof' && (
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        )}

        <SearchBar
          className="min-w-[12rem] flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search item number or product..."
        />

        <a
          href={getHoldingsExportUrl({ asOf: activeAsOf })}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={16} /> Excel
        </a>
      </div>

      {mode === 'asof' && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Point-in-time view is reconstructed from movement history. Items that
          never moved are shown at their current location.
        </div>
      )}

      {waitingForDate ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <Users size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base text-gray-500">Pick a date to reconstruct holdings.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <Users size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base text-gray-500">No inventory to show.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = !collapsed[g.locationId];
            return (
              <div key={g.locationId} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <button
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [g.locationId]: !c[g.locationId] }))
                  }
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-gray-50"
                >
                  {isOpen ? (
                    <ChevronDown size={18} className="shrink-0 text-gray-400" />
                  ) : (
                    <ChevronRight size={18} className="shrink-0 text-gray-400" />
                  )}
                  <span className="flex-1 font-bold text-gray-900">{g.locationName}</span>
                  <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-sm font-semibold text-primary-700">
                    {g.count}
                  </span>
                </button>
                {isOpen && (
                  <table className="w-full text-sm">
                    <tbody>
                      {g.items.map((it) => (
                        <tr key={it.id} className="border-t border-gray-50">
                          <td className="px-5 py-2.5">
                            <span className="block font-mono text-xs font-semibold text-gray-900">
                              {it.itemNumber || '—'}
                            </span>
                            <span className="block truncate text-xs text-gray-500">
                              {it.productLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-500">
                            Lot {it.lot}
                          </td>
                          <td className="px-5 py-2.5 text-right text-xs text-gray-400">
                            {it.expDate ? it.expDate.slice(0, 10) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
