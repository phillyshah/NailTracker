import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, PackageCheck } from 'lucide-react';
import { listParLevels, setParLevel, type ParLevel } from '../../api/parlevels';
import { listDistributors } from '../../api/distributors';
import { productCatalog } from '../../utils/catalog';
import { matchesItemSearch } from '../../utils/itemSearch';
import { HelpBanner } from '../../components/HelpBanner';
import { SearchBar } from '../../components/SearchBar';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

const keyOf = (itemNumber: string, distId: string | null) => `${itemNumber}|${distId ?? 'global'}`;

export default function ParLevels() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Local input values keyed by `${itemNumber}|${distId|global}`.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: levels = [] } = useQuery({ queryKey: ['par-levels'], queryFn: listParLevels });
  const { data: distributors = [] } = useQuery({ queryKey: ['distributors'], queryFn: listDistributors });

  // Server par values, indexed for quick lookup.
  const serverValues = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of levels as ParLevel[]) m[keyOf(l.itemNumber, l.distributorId)] = l.minStock;
    return m;
  }, [levels]);

  const saveMutation = useMutation({
    mutationFn: (input: { itemNumber: string; gtinShort: string; distributorId: string | null; minStock: number }) =>
      setParLevel(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['par-levels'] }),
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  function valueFor(itemNumber: string, distId: string | null): string {
    const k = keyOf(itemNumber, distId);
    if (k in edits) return edits[k];
    const v = serverValues[k];
    return v == null ? '' : String(v);
  }

  function commit(itemNumber: string, gtinShort: string, distId: string | null) {
    const k = keyOf(itemNumber, distId);
    if (!(k in edits)) return; // untouched
    const raw = edits[k].trim();
    const next = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(next) || next < 0) {
      addToast('Par must be 0 or greater', 'error');
      return;
    }
    const prev = serverValues[k] ?? 0;
    if (next !== prev) {
      saveMutation.mutate({ itemNumber, gtinShort, distributorId: distId, minStock: next });
    }
    setEdits((e) => {
      const copy = { ...e };
      delete copy[k];
      return copy;
    });
  }

  const visible = productCatalog.filter((c) =>
    matchesItemSearch({ itemNumber: c.itemNumber, productLabel: c.label, gtinShort: c.gtinShort }, search),
  );

  return (
    <div className="mx-auto max-w-2xl lg:max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <button onClick={() => navigate('/labs')} className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700">
        <ArrowLeft size={20} /> Back to TrackerLabs
      </button>

      <div className="mb-2 flex items-center gap-2">
        <PackageCheck size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">Par Levels</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">Beta</span>
      </div>

      <HelpBanner storageKey="par-levels">
        Set the minimum stock you want to keep for each item. The <strong>Global</strong> value
        applies to every distributor; expand an item to set a <strong>per-distributor override</strong>
        where a site needs more or fewer. Items below par show up on the <strong>Reorder Report</strong>.
        Leave a field blank (or 0) to clear it.
      </HelpBanner>

      <div className="mb-3 flex items-center justify-between gap-3">
        <SearchBar
          className="flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search item number or product..."
        />
        <button
          onClick={() => navigate('/labs/reorder')}
          className="shrink-0 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Reorder Report
        </button>
      </div>

      <div className="space-y-2">
        {visible.map((c) => {
          const isOpen = expanded.has(c.itemNumber);
          return (
            <div key={c.itemNumber} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setExpanded((s) => {
                      const next = new Set(s);
                      next.has(c.itemNumber) ? next.delete(c.itemNumber) : next.add(c.itemNumber);
                      return next;
                    })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {isOpen ? <ChevronDown size={18} className="shrink-0 text-gray-400" /> : <ChevronRight size={18} className="shrink-0 text-gray-400" />}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{c.itemNumber}</span>
                    <span className="block truncate text-xs text-gray-500">{c.label}</span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">Global</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={valueFor(c.itemNumber, null)}
                    onChange={(e) => setEdits((ed) => ({ ...ed, [keyOf(c.itemNumber, null)]: e.target.value }))}
                    onBlur={() => commit(c.itemNumber, c.gtinShort, null)}
                    placeholder="—"
                    className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Per-distributor overrides</p>
                  {distributors.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-gray-700">{d.name}</span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={valueFor(c.itemNumber, d.id)}
                        onChange={(e) => setEdits((ed) => ({ ...ed, [keyOf(c.itemNumber, d.id)]: e.target.value }))}
                        onBlur={() => commit(c.itemNumber, c.gtinShort, d.id)}
                        placeholder="uses global"
                        className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">No items match "{search}"</p>
        )}
      </div>
    </div>
  );
}
