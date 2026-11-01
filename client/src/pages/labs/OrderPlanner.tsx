import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Factory, Info, TriangleAlert } from 'lucide-react';
import {
  getOrderPlan,
  getPlanExportUrl,
  setOpenOrder,
  type PlanAssumptions,
} from '../../api/orderplan';
import { matchesItemSearch } from '../../utils/itemSearch';
import { HelpBanner } from '../../components/HelpBanner';
import { SearchBar } from '../../components/SearchBar';
import { Button } from '../../components/Button';

/**
 * Buying from the manufacturer, as distinct from replenishing a distributor.
 *
 * The reorder report cannot answer this: it compares each distributor's shelf
 * to a par over a few weeks, and excludes Home Office. A manufacturer order has
 * a 6-12 month lead time and lands in Home Office, so the question is "what
 * will the whole network consume between now and the delivery after next", and
 * the answer cannot come from per-SKU history — on a new line most SKUs have
 * almost none. So procedure volume is typed in, and the catalogue is exploded
 * from it using ratios and a size mix measured from the usage that does exist.
 */

interface Inputs extends PlanAssumptions {
  /** Percentage of nails that are long. Held as a percent for the input. */
  longNailPct: number;
}

const STORAGE_KEY = 'orderPlanner.inputs';

/** Numbers typed on this screen are shared assumptions, so they persist. */
function loadInputs(): Partial<Inputs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Inputs>) : {};
  } catch {
    return {};
  }
}

export default function OrderPlanner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [onlyToOrder, setOnlyToOrder] = useState(true);
  const [inputs, setInputs] = useState<Partial<Inputs>>(loadInputs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
    } catch {
      // A private-mode browser that refuses storage must not break the screen.
    }
  }, [inputs]);

  // Anything not typed is left off the request so the server fills it from the
  // observed data (cases/month, long-nail share) or its own defaults.
  const query = useMemo(
    () => ({
      casesPerMonth: inputs.casesPerMonth,
      leadTimeMonths: inputs.leadTimeMonths,
      coverMonths: inputs.coverMonths,
      usableShelfMonths: inputs.usableShelfMonths,
      longNailShare:
        inputs.longNailPct === undefined ? undefined : inputs.longNailPct / 100,
    }),
    [inputs],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['order-plan', query],
    queryFn: () => getOrderPlan(query),
  });

  const save = useMutation({
    mutationFn: setOpenOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order-plan'] }),
  });

  // Memoized because it feeds a useMemo below — a bare `?? []` mints a new
  // array identity every render and silently defeats the memo.
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const r of rows) if (!seen.includes(r.category)) seen.push(r.category);
    return seen;
  }, [rows]);

  const visible = rows.filter(
    (r) =>
      (!category || r.category === category) &&
      (!onlyToOrder || r.suggested > 0) &&
      matchesItemSearch(
        { itemNumber: r.itemNumber, productLabel: r.productLabel, gtinShort: r.gtinShort },
        search,
      ),
  );

  const ev = data?.evidence;
  const thinEvidence = (ev?.cases ?? 0) < 20;
  const set = (patch: Partial<Inputs>) => setInputs((prev) => ({ ...prev, ...patch }));

  const field = (
    label: string,
    key: keyof Inputs,
    placeholder: number | undefined,
    hint: string,
  ) => (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <input
        type="number"
        min={0}
        inputMode="decimal"
        value={inputs[key] ?? ''}
        placeholder={placeholder === undefined ? '' : String(placeholder)}
        onChange={(e) =>
          set({ [key]: e.target.value === '' ? undefined : Number(e.target.value) } as Partial<Inputs>)
        }
        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:border-primary-500 focus:outline-none"
      />
      <span className="mt-1 block text-xs text-gray-400">{hint}</span>
    </label>
  );

  return (
    <div className="mx-auto max-w-2xl lg:max-w-5xl">
      <button
        onClick={() => navigate('/labs')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to TrackerLabs
      </button>

      <div className="mb-2 flex items-center gap-2">
        <Factory size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">Order Planner</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">
          Beta
        </span>
      </div>

      <HelpBanner storageKey="order-planner">
        What to buy from the <strong>manufacturer</strong> — not what to send a distributor
        (that's the Reorder Report). Type the surgical cases you expect per month and how
        long the factory takes; the planner works out how many nails that is, explodes the
        screws from it using the ratios measured from your own cases, splits each category
        across sizes by what's actually been used, then subtracts stock on hand and anything
        already on order. Quantities that couldn't be consumed before they expire are capped.
      </HelpBanner>

      <div className="mb-3 grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-sm lg:grid-cols-5">
        {field(
          'Cases / month',
          'casesPerMonth',
          ev?.casesPerMonthObserved,
          ev ? `${ev.casesPerMonthObserved} observed` : 'from your usage',
        )}
        {field('Lead time (mo)', 'leadTimeMonths', data?.assumptions.leadTimeMonths, 'factory quote')}
        {field('Cover on arrival (mo)', 'coverMonths', data?.assumptions.coverMonths, 'buffer left when it lands')}
        {field('Usable shelf life (mo)', 'usableShelfMonths', data?.assumptions.usableShelfMonths, 'caps slow movers')}
        {field(
          'Long nails (%)',
          'longNailPct',
          data ? Math.round(data.longNailShare * 100) : undefined,
          'rest are short',
        )}
      </div>

      {data && (
        <div className="mb-3 rounded-2xl bg-white p-4 text-sm shadow-sm">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-gray-500">
              Horizon <strong className="text-gray-900">{data.horizonMonths} months</strong>
            </span>
            <span className="text-gray-500">
              Nails over horizon <strong className="text-gray-900">{data.totalNails}</strong>
            </span>
            <span className="text-gray-500">
              Units to order <strong className="text-primary-700">{data.totalSuggested}</strong>
            </span>
            {data.cappedCount > 0 && (
              <span className="text-gray-500">
                Shelf-life capped <strong className="text-amber-700">{data.cappedCount}</strong>
              </span>
            )}
          </div>

          {ev && (
            <p className="mt-2 flex gap-1.5 text-xs text-gray-500">
              <Info size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <span>
                Measured from <strong>{ev.cases}</strong> cases and{' '}
                <strong>{ev.unitsConsumed}</strong> units over{' '}
                <strong>{ev.historyMonths}</strong> months
                {Object.keys(ev.ratios).length > 0 && (
                  <>
                    {' '}· per nail:{' '}
                    {Object.entries(ev.ratios)
                      .map(([cat, r]) => `${r} ${cat.toLowerCase()}`)
                      .join(', ')}
                  </>
                )}
                . Ratios are a <strong>lower bound</strong> — a screw used but never
                received is invisible here, so the real figure can only be higher.
                {ev.unmeasuredCount > 0 && (
                  <> {ev.unmeasuredCount} catalogue sizes have never been used and get no
                  suggestion; order those for set completeness, not from demand.</>
                )}
              </span>
            </p>
          )}

          {thinEvidence && (
            <p className="mt-2 flex gap-1.5 rounded-xl bg-amber-50 p-2 text-xs text-amber-800">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                Only {ev?.cases ?? 0} cases recorded. The size mix is the weakest part of
                this plan at that sample — treat the category totals as the real output and
                the per-size split as a starting point to adjust by hand.
              </span>
            </p>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBar
          className="min-w-[12rem] flex-1"
          value={search}
          onChange={setSearch}
          placeholder="Search item number or product..."
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button
          variant={onlyToOrder ? 'primary' : 'secondary'}
          size="sm"
          className="shrink-0"
          onClick={() => setOnlyToOrder((v) => !v)}
        >
          {onlyToOrder ? 'To order only' : 'Showing all'}
        </Button>
        <a
          href={getPlanExportUrl(query)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={16} /> Excel
        </a>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <Factory size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-base text-gray-500">Nothing to order</p>
          <p className="mt-1 text-sm text-gray-400">
            {rows.length === 0
              ? 'Enter the cases you expect per month to build a plan.'
              : 'Stock on hand and on order already cover this horizon.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-3 py-3 font-semibold">Category</th>
                <th className="px-3 py-3 text-right font-semibold">Need</th>
                <th className="px-3 py-3 text-right font-semibold">On hand</th>
                <th className="px-3 py-3 text-right font-semibold">On order</th>
                <th className="px-3 py-3 text-right font-semibold">Order</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.itemNumber} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <span className="block font-mono text-xs font-semibold text-gray-900">
                      {r.itemNumber}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{r.productLabel}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{r.category}</td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {r.required}
                    <span className="ml-1 text-xs text-gray-400">({r.perMonth}/mo)</span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{r.onHand}</td>
                  <td className="px-3 py-3 text-right">
                    {/* Typed, not derived: whoever placed the order keeps this
                        current, and the plan nets it out. */}
                    <input
                      type="number"
                      min={0}
                      defaultValue={r.onOrder || ''}
                      placeholder="0"
                      onBlur={(e) => {
                        const qty = e.target.value === '' ? 0 : Number(e.target.value);
                        if (!Number.isFinite(qty) || qty < 0 || qty === r.onOrder) return;
                        save.mutate({ itemNumber: r.itemNumber, quantity: qty });
                      }}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-primary-700">
                    {r.suggested}
                    {r.cappedByShelfLife && (
                      <span
                        className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-700"
                        title={`Demand short by ${r.gap}, but only ${r.suggested} can be used before expiry`}
                      >
                        cap
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
