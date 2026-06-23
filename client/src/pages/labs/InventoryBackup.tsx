import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, DatabaseBackup, FileSpreadsheet, FileJson } from 'lucide-react';
import { HelpBanner } from '../../components/HelpBanner';
import { Button } from '../../components/Button';
import { getBackupExcelUrl, getBackupJsonUrl } from '../../api/backup';

type Preset = '6m' | '1y' | 'all' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
  { id: '6m', label: 'Last 6 months' },
  { id: '1y', label: 'Last year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' },
];

/** YYYY-MM-DD for an offset of `months` back from today (0 = today). */
function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export default function InventoryBackup() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<Preset>('6m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Resolve the active range from the chosen preset.
  const range = (() => {
    switch (preset) {
      case '6m':
        return { from: isoMonthsAgo(6), to: '' };
      case '1y':
        return { from: isoMonthsAgo(12), to: '' };
      case 'all':
        return { from: '', to: '' };
      case 'custom':
        return { from: customFrom, to: customTo };
    }
  })();

  const customInvalid =
    preset === 'custom' && !!range.from && !!range.to && range.from > range.to;
  const canDownload = !customInvalid;

  function download(url: string) {
    window.location.href = url;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => navigate('/labs')}
        className="mb-4 flex items-center gap-2 text-base text-primary-600 hover:text-primary-700"
      >
        <ArrowLeft size={20} /> Back to TrackerLabs
      </button>

      <div className="mb-2 flex items-center gap-2">
        <DatabaseBackup size={22} className="text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">Inventory Backup</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">
          Beta
        </span>
      </div>

      <HelpBanner storageKey="inventory-backup">
        Download a backup of inventory received in a chosen window. The backup
        includes every item created in the period — <strong>even ones since used,
        transferred, or removed</strong> — with its current status and location.
        Use <strong>Excel</strong> for a readable record, or <strong>JSON</strong>{' '}
        for a complete snapshot (all fields + movement history) to archive.
      </HelpBanner>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-2 text-sm font-semibold text-gray-700">Period</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={
                'rounded-xl border px-3 py-2 text-sm font-medium transition-colors ' +
                (preset === p.id
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">From</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 block rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">To</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 block rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </label>
          </div>
        )}

        {customInvalid && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            The “From” date must be on or before the “To” date.
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="primary"
            className="w-full sm:flex-1"
            disabled={!canDownload}
            onClick={() => download(getBackupExcelUrl({ from: range.from, to: range.to }))}
          >
            <FileSpreadsheet size={18} /> Download Excel
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:flex-1"
            disabled={!canDownload}
            onClick={() => download(getBackupJsonUrl({ from: range.from, to: range.to }))}
          >
            <FileJson size={18} /> Download JSON
          </Button>
        </div>
      </div>
    </div>
  );
}
