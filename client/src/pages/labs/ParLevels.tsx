import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, PackageCheck } from 'lucide-react';
import { listParLevels, setParLevel, getUsageRates, type ParLevel } from '../../api/parlevels';
import { listDistributors } from '../../api/distributors';
import { catalogByGroup } from '../../utils/catalog';
import { matchesItemSearch } from '../../utils/itemSearch';
import { Button } from '../../components/Button';
import { HelpBanner } from '../../components/HelpBanner';
import { SearchBar } from '../../components/SearchBar';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

// Local edit keys. Group par: `cat:<group>`. SKU par: `item:<itemNumber>:<dist|global>`.
const catKey = (group: string) => `cat:${group}`;
const itemKey = (itemNumber: string, distId: string | null) =>
  `item:${itemNumber}:${distId ?? 'global'}`;

export default function ParLevels() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  // Local input values keyed as above.
  const [edits, setEdits] = useState<Record<string, string>>({});
  // What a NEWLY typed value means. Existing rows keep their own basis and say
  // so in their caption, so switching this never silently reinterprets a saved
  // par — it only decides how the next thing you type is stored.
  const [mode, setMode] = useState<'qty' | 'cover'>('qty');

  const { data: levels = [] } = useQuery({ queryKey: ['par-levels'], queryFn: listParLevels });
  const { data: distributors = [] } = useQuery({ queryKey: ['distributors'], queryFn: listDistributors });
  const { data: usage } = useQuery({ queryKey: ['par-usage'], queryFn: getUsageRates });

  // Server par values with the basis each was saved in. A 'cover' row's number
  // is MONTHS, not units — the caption under the input makes that explicit.
  interface StoredPar { value: number; basis: 'qty' | 'cover' }
  const serverValues = useMemo(() => {
    const m: Record<string, StoredPar> = {};
    for (const l of levels as ParLevel[]) {
      const entry: StoredPar =
        l.coverMonths != null && l.coverMonths > 0
          ? { value: l.coverMonths, basis: 'cover' }
          : { value: l.minStock, basis: 'qty' };
      if (l.scope === 'category' && l.category) m[catKey(l.category)] = entry;
      else if (l.itemNumber) m[itemKey(l.itemNumber, l.distributorId)] = entry;
    }
    return m;
  }, [levels]);

  /** Units/month for the preview: the exact pair if we have one, else the
   *  per-item average across field distributors (used by global/group inputs). */
  function rateFor(itemNumber: string | null, distId: string | null): number {
    if (!usage || !itemNumber) return 0;
    if (distId) return usage.byPair[`${itemNumber}|${distId}`] ?? 0;
    return usage.byItem[itemNumber] ?? 0;
  }



  const saveMutation = useMutation({
    mutationFn: setParLevel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['par-levels'] }),
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  function numAt(key: string): number | undefined {
    if (key in edits) {
      const raw = edits[key].trim();
      return raw === '' ? 0 : Number(raw);
    }
    return serverValues[key]?.value;
  }

  function valueFor(key: string): string {
    if (key in edits) return edits[key];
    const v = serverValues[key];
    return v == null ? '' : String(v.value);
  }

  /**
   * The line under an input that says what the number actually means, e.g.
   * "6 mo ≈ 9 units (1.5/mo)". Without it a bare "6" is ambiguous between six
   * units and six months.
   */
  function caption(key: string, rate: number): string | null {
    const v = numAt(key);
    if (v == null || v <= 0) return null;
    if (basisAt(key) === 'qty') return `${v} unit${v === 1 ? '' : 's'}`;
    if (rate <= 0) return `${v} mo · no usage yet — no par applies`;
    return `${v} mo ≈ ${Math.ceil(rate * v)} units (${rate}/mo)`;
  }

  /**
   * Group-level caption. A group cover par has NO single quantity: every SKU in
   * the group is sized from its own usage rate. Averaging across the group
   * would be actively misleading — most sizes have little or no usage, so the
   * average collapses toward zero and understates the busy sizes. Say what it
   * does instead of inventing a number.
   */
  function groupCaption(key: string): string | null {
    const v = numAt(key);
    if (v == null || v <= 0) return null;
    if (basisAt(key) === 'qty') return `${v} unit${v === 1 ? '' : 's'} each`;
    return `${v} mo · each size sized from its own usage`;
  }

  /** The basis a key is currently showing: an unsaved edit uses the page mode. */
  function basisAt(key: string): 'qty' | 'cover' {
    if (key in edits) return mode;
    return serverValues[key]?.basis ?? mode;
  }

  function parseNext(key: string): number | null {
    const raw = (edits[key] ?? '').trim();
    const next = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(next) || next < 0) {
      addToast('Par must be 0 or greater', 'error');
      return null;
    }
    return next;
  }

  function clearEdit(key: string) {
    setEdits((e) => {
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
  }

  function commitCategory(group: string) {
    const k = catKey(group);
    if (!(k in edits)) return;
    const next = parseNext(k);
    if (next == null) return;
    const prev = serverValues[k];
    if (next !== prev?.value || mode !== prev?.basis) {
      saveMutation.mutate(
        mode === 'cover'
          ? { scope: 'category', category: group, coverMonths: next }
          : { scope: 'category', category: group, minStock: next },
      );
    }
    clearEdit(k);
  }

  function commitItem(itemNumber: string, gtinShort: string, distId: string | null) {
    const k = itemKey(itemNumber, distId);
    if (!(k in edits)) return;
    const next = parseNext(k);
    if (next == null) return;
    const prev = serverValues[k];
    if (next !== prev?.value || mode !== prev?.basis) {
      const base = { scope: 'item' as const, itemNumber, gtinShort, distributorId: distId };
      saveMutation.mutate(
        mode === 'cover' ? { ...base, coverMonths: next } : { ...base, minStock: next },
      );
    }
    clearEdit(k);
  }

  // Filter SKUs by the search box; while searching, force groups open.
  const groups = useMemo(
    () =>
      catalogByGroup
        .map((g) => ({
          group: g.group,
          items: g.items.filter((c) =>
            matchesItemSearch({ itemNumber: c.itemNumber, productLabel: c.label, gtinShort: c.gtinShort }, search),
          ),
        }))
        .filter((g) => (search ? g.items.length > 0 : true)),
    [search],
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
        Set the minimum stock you want to keep. The fastest way is a <strong>Group par</strong> —
        one number that applies to every size in a product group (e.g. all Interlocking Screws).
        Expand a group to fine-tune an <strong>individual item</strong>, which overrides the group,
        and expand an item to set a <strong>per-distributor</strong> value. Items below par show up
        on the <strong>Reorder Report</strong>. Leave a field blank (or 0) to clear it.
        <br />
        <br />
        You can enter a par as a flat <strong>quantity</strong>, or as{' '}
        <strong>months of cover</strong> — say "12" and the system works out the quantity from how
        fast that item actually moves, then keeps it in step as usage changes. Set months of cover
        on a whole group and every size gets a par sized to its own demand.
      </HelpBanner>

      {/* What a newly typed number means. Saved rows keep their own basis, shown
          beneath each box, so flipping this never reinterprets existing pars. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Enter pars as</span>
        <div className="inline-flex rounded-xl border border-gray-300 p-1">
          {([
            ['qty', 'Quantity'],
            ['cover', 'Months of cover'],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                mode === m ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'cover' && (
          <span className="text-xs text-gray-500">
            Typing <strong>12</strong> means "hold 12 months of stock"
            {usage ? ` · usage averaged over the last ${usage.windowMonths} months` : ''}
          </span>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <SearchBar
          className="flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search item number or product..."
        />
        <Button size="sm" className="shrink-0" onClick={() => navigate('/labs/reorder')}>
          Reorder Report
        </Button>
      </div>

      <div className="space-y-2">
        {groups.map(({ group, items }) => {
          const groupOpen = !!search || openGroups.has(group);
          const groupVal = numAt(catKey(group));
          return (
            <div key={group} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setOpenGroups((s) => {
                      const next = new Set(s);
                      if (next.has(group)) { next.delete(group); } else { next.add(group); }
                      return next;
                    })
                  }
                  disabled={!!search}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-100"
                >
                  {groupOpen ? <ChevronDown size={18} className="shrink-0 text-gray-400" /> : <ChevronRight size={18} className="shrink-0 text-gray-400" />}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-900">{group}</span>
                    <span className="block truncate text-xs text-gray-500">{items.length} item{items.length === 1 ? '' : 's'}</span>
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="text-xs font-medium text-gray-500">Group par</label>
                  <div className="text-right">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={valueFor(catKey(group))}
                      onChange={(e) => setEdits((ed) => ({ ...ed, [catKey(group)]: e.target.value }))}
                      onBlur={() => commitCategory(group)}
                      placeholder="—"
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm focus:border-primary-500 focus:outline-none"
                    />
                    {groupCaption(catKey(group)) && (
                      <p className="mt-0.5 whitespace-nowrap text-[11px] text-gray-500">
                        {groupCaption(catKey(group))}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {groupOpen && (
                <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                  {items.map((c) => {
                    const itemOpen = openItems.has(c.itemNumber);
                    const skuGlobal = numAt(itemKey(c.itemNumber, null));
                    return (
                      <div key={c.itemNumber} className="rounded-xl bg-gray-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setOpenItems((s) => {
                                const next = new Set(s);
                                if (next.has(c.itemNumber)) { next.delete(c.itemNumber); } else { next.add(c.itemNumber); }
                                return next;
                              })
                            }
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            {itemOpen ? <ChevronDown size={14} className="shrink-0 text-gray-400" /> : <ChevronRight size={14} className="shrink-0 text-gray-400" />}
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-xs font-semibold text-gray-900">{c.itemNumber}</span>
                              <span className="block truncate text-xs text-gray-500">{c.label}</span>
                            </span>
                          </button>
                          <div className="shrink-0 text-right">
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={valueFor(itemKey(c.itemNumber, null))}
                              onChange={(e) => setEdits((ed) => ({ ...ed, [itemKey(c.itemNumber, null)]: e.target.value }))}
                              onBlur={() => commitItem(c.itemNumber, c.gtinShort, null)}
                              placeholder={groupVal ? String(groupVal) : '—'}
                              className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm focus:border-primary-500 focus:outline-none"
                            />
                            {caption(itemKey(c.itemNumber, null), rateFor(c.itemNumber, null)) && (
                              <p className="mt-0.5 whitespace-nowrap text-[11px] text-gray-500">
                                {caption(itemKey(c.itemNumber, null), rateFor(c.itemNumber, null))}
                              </p>
                            )}
                          </div>
                        </div>

                        {itemOpen && (
                          <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Per-distributor overrides</p>
                            {distributors.map((d) => {
                              const inherits = skuGlobal ?? groupVal;
                              return (
                                <div key={d.id} className="flex items-center justify-between gap-3">
                                  <span className="truncate text-sm text-gray-700">{d.name}</span>
                                  <div className="text-right">
                                    <input
                                      type="number"
                                      min={0}
                                      inputMode="numeric"
                                      value={valueFor(itemKey(c.itemNumber, d.id))}
                                      onChange={(e) => setEdits((ed) => ({ ...ed, [itemKey(c.itemNumber, d.id)]: e.target.value }))}
                                      onBlur={() => commitItem(c.itemNumber, c.gtinShort, d.id)}
                                      placeholder={inherits ? String(inherits) : 'inherits'}
                                      className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-sm focus:border-primary-500 focus:outline-none"
                                    />
                                    {caption(itemKey(c.itemNumber, d.id), rateFor(c.itemNumber, d.id)) && (
                                      <p className="mt-0.5 whitespace-nowrap text-[11px] text-gray-500">
                                        {caption(itemKey(c.itemNumber, d.id), rateFor(c.itemNumber, d.id))}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">No items match "{search}"</p>
        )}
      </div>
    </div>
  );
}
