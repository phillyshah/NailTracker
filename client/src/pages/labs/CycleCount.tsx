import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Keyboard, Check, AlertTriangle, PackageX, PackagePlus } from 'lucide-react';
import { listDistributors } from '../../api/distributors';
import { useAuth } from '../../context/AuthContext';
import {
  previewAudit,
  commitAudit,
  type AuditPreview,
  type AuditCommitResult,
} from '../../api/audits';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { Button } from '../../components/Button';
import { SuccessCard } from '../../components/SuccessCard';
import { HelpBanner } from '../../components/HelpBanner';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../utils/cn';

export default function CycleCount() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const [distributorId, setDistributorId] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [preview, setPreview] = useState<AuditPreview | null>(null);
  const [step, setStep] = useState<'scan' | 'review' | 'done'>('scan');
  const [addExtras, setAddExtras] = useState<Set<string>>(new Set());
  const [removeMissing, setRemoveMissing] = useState<Set<string>>(new Set());
  const [manualEntry, setManualEntry] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AuditCommitResult | null>(null);

  const { user } = useAuth();
  const isDistributor = user?.role === 'distributor';

  const { data: distributors = [] } = useQuery({ queryKey: ['distributors'], queryFn: listDistributors });

  // A distributor account counts only its own shelf — lock the selection to it.
  useEffect(() => {
    if (!isDistributor || !user?.distributorId || distributorId) return;
    const own = distributors.find((d) => d.id === user.distributorId);
    if (own) {
      setDistributorId(own.id);
      setDistributorName(own.name);
    }
  }, [isDistributor, user?.distributorId, distributors, distributorId]);

  async function refresh(list: string[]) {
    if (!distributorId) return;
    setBusy(true);
    try {
      const data = await previewAudit(distributorId, list);
      setPreview(data);
      // Pre-check every extra (the common intent is "add what I found").
      setAddExtras(new Set(data.extra.map((e) => e.scanKey)));
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function addBarcode(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const next = [...barcodes, trimmed];
    setBarcodes(next);
    if (step === 'review') refresh(next);
  }

  async function goReview() {
    await refresh(barcodes);
    setStep('review');
  }

  async function finish() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await commitAudit({
        distributorId,
        matchedCount: preview.counts.matched,
        extras: preview.extra.filter((e) => addExtras.has(e.scanKey)),
        missingItemIds: [...removeMissing],
      });
      setResult(res);
      setStep('done');
    } catch (err) {
      addToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setBarcodes([]);
    setPreview(null);
    setAddExtras(new Set());
    setRemoveMissing(new Set());
    setResult(null);
    setStep('scan');
  }

  const Back = (
    <button
      onClick={() => navigate(isDistributor ? '/home' : '/labs')}
      className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
    >
      <ArrowLeft size={20} /> {isDistributor ? 'Back to Home' : 'Back to TrackerLabs'}
    </button>
  );

  const Title = (
    <div className="mb-2 flex items-center gap-2">
      <ClipboardList size={22} className="text-primary-600" />
      <h2 className="text-xl font-bold text-gray-900">Cycle Count</h2>
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">Beta</span>
    </div>
  );

  // ---- Done -------------------------------------------------------------
  if (step === 'done' && result) {
    return (
      <div className="mx-auto max-w-2xl">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        {Back}
        {Title}
        <SuccessCard
          title="Audit saved"
          id={result.auditId}
          actions={
            <>
              <Button className="flex-1" onClick={reset}>
                New Count
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => navigate('/labs/audits')}>
                View History
              </Button>
            </>
          }
        >
          {result.matchedCount} matched · {result.added} added · {result.removed} removed at {distributorName}
        </SuccessCard>
      </div>
    );
  }

  // ---- Review -----------------------------------------------------------
  if (step === 'review' && preview) {
    const { matched, extra, missing, errors } = preview;
    return (
      <div className="mx-auto max-w-2xl lg:max-w-4xl">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        {Back}
        {Title}

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat label="Matched" value={matched.length} tone="green" />
          <Stat label="Missing" value={missing.length} tone="amber" />
          <Stat label="Extra" value={extra.length} tone="blue" />
        </div>

        {errors.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{errors.length} scan(s) couldn't be read and were ignored.</span>
          </div>
        )}

        {/* Missing — in system, not found on the shelf */}
        <Section
          icon={<PackageX size={18} className="text-amber-600" />}
          title={`Missing (${missing.length})`}
          subtitle="In the system but not scanned. Check the ones you want to remove from inventory."
          action={
            missing.length > 0 && (
              <SelectToggle
                allSelected={missing.length > 0 && missing.every((m) => removeMissing.has(m.itemId))}
                onAll={() => setRemoveMissing(new Set(missing.map((m) => m.itemId)))}
                onNone={() => setRemoveMissing(new Set())}
              />
            )
          }
        >
          {missing.map((m) => (
            <Row
              key={m.itemId}
              checked={removeMissing.has(m.itemId)}
              onToggle={() =>
                setRemoveMissing((s) => {
                  const next = new Set(s);
                  next.has(m.itemId) ? next.delete(m.itemId) : next.add(m.itemId);
                  return next;
                })
              }
              title={m.itemNumber || m.gtinShort}
              subtitle={`${m.productLabel} · LOT ${m.lot}`}
            />
          ))}
          {missing.length === 0 && <Empty>Nothing missing — every system unit was scanned.</Empty>}
        </Section>

        {/* Extra — scanned, not in system */}
        <Section
          icon={<PackagePlus size={18} className="text-blue-600" />}
          title={`Extra (${extra.length})`}
          subtitle="Scanned but not in the system. Check the ones you want to add as stock here."
          action={
            extra.length > 0 && (
              <SelectToggle
                allSelected={extra.length > 0 && extra.every((e) => addExtras.has(e.scanKey))}
                onAll={() => setAddExtras(new Set(extra.map((e) => e.scanKey)))}
                onNone={() => setAddExtras(new Set())}
              />
            )
          }
        >
          {extra.map((e) => (
            <Row
              key={e.scanKey}
              checked={addExtras.has(e.scanKey)}
              onToggle={() =>
                setAddExtras((s) => {
                  const next = new Set(s);
                  next.has(e.scanKey) ? next.delete(e.scanKey) : next.add(e.scanKey);
                  return next;
                })
              }
              title={e.itemNumber || e.gtinShort}
              subtitle={`${e.productLabel} · LOT ${e.lot}`}
            />
          ))}
          {extra.length === 0 && <Empty>Nothing extra — every scan matched a system unit.</Empty>}
        </Section>

        <div className="sticky bottom-20 lg:bottom-4 z-30 mt-4 flex gap-3 bg-slate-50 py-3">
          <Button variant="secondary" className="flex-1" onClick={() => setStep('scan')}>
            Scan more
          </Button>
          <Button className="flex-1" onClick={finish} disabled={busy}>
            {busy ? 'Saving…' : `Finish (+${addExtras.size} / −${removeMissing.size})`}
          </Button>
        </div>
      </div>
    );
  }

  // ---- Scan -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {Back}
      {Title}

      <HelpBanner storageKey="cycle-count">
        Pick a distributor, then scan everything physically on the shelf. When you're done,
        tap <strong>Review</strong> to see what <strong>matches</strong>, what's <strong>missing</strong>
        (in the system but not on the shelf), and what's <strong>extra</strong> (on the shelf but not in
        the system). Fix discrepancies in one step, and the count is saved as an audit record.
      </HelpBanner>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-1">Distributor to count</label>
        {isDistributor ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base font-medium text-gray-700">
            {distributorName || '…'}
          </p>
        ) : (
          <select
            value={distributorId}
            onChange={(e) => {
              setDistributorId(e.target.value);
              setDistributorName(e.target.selectedOptions[0]?.text || '');
              setBarcodes([]);
              setPreview(null);
            }}
            className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
          >
            <option value="">Select a distributor…</option>
            {distributors.filter((d) => d.active).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        {barcodes.length > 0 && (
          <p className="mt-2 text-xs text-gray-400">{barcodes.length} scanned so far at {distributorName}.</p>
        )}
      </div>

      {distributorId ? (
        <>
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
            <BarcodeScanner
              onResult={(barcode) => addBarcode(barcode)}
              onError={(msg) => {
                addToast(msg, 'info');
                setShowManual(true);
              }}
            />
            <button
              onClick={() => setShowManual((v) => !v)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50"
            >
              <Keyboard size={20} /> Enter barcode manually
            </button>
            {showManual && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addBarcode(manualEntry);
                  setManualEntry('');
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="text"
                  value={manualEntry}
                  onChange={(e) => setManualEntry(e.target.value)}
                  placeholder="Paste or type the barcode"
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none"
                />
                <Button type="submit">Add</Button>
              </form>
            )}
          </div>

          <Button className="w-full" onClick={goReview} disabled={busy}>
            {busy ? 'Reconciling…' : `Review count (${barcodes.length} scanned)`}
          </Button>
        </>
      ) : (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          Choose a distributor to start counting.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' | 'blue' }) {
  const tones = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <div className={cn('rounded-xl px-3 py-3 text-center', tones[tone])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide">{label}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        {action}
      </div>
      <p className="mb-3 text-xs text-gray-500">{subtitle}</p>
      <div className="max-h-72 space-y-2 overflow-y-auto">{children}</div>
    </div>
  );
}

function SelectToggle({ allSelected, onAll, onNone }: { allSelected: boolean; onAll: () => void; onNone: () => void }) {
  return (
    <button onClick={allSelected ? onNone : onAll} className="text-sm font-medium text-primary-600 hover:underline">
      {allSelected ? 'Clear' : 'Select all'}
    </button>
  );
}

function Row({ checked, onToggle, title, subtitle }: { checked: boolean; onToggle: () => void; title: string; subtitle: string }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors',
        checked ? 'border-primary-400 bg-primary-50' : 'border-gray-200',
      )}
    >
      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border-2', checked ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-300')}>
        {checked && <Check size={14} />}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-xs font-semibold text-gray-900">{title}</span>
        <span className="block truncate text-xs text-gray-500">{subtitle}</span>
      </span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-sm text-gray-400">{children}</p>;
}
